"""Versioned model bundle: an XGBoost model saved as JSON plus a metadata file.

No pickles: the model loads across library versions, and loading a bundle cannot
execute code. The metadata carries everything serving needs to reproduce training
exactly — feature order, categorical vocabularies, the frozen amount quantiles and
the decision thresholds chosen on the validation window.
"""
from __future__ import annotations

import json
import os
import threading
from dataclasses import dataclass

import numpy as np
import xgboost as xgb

from .features import CATEGORICAL, FEATURES, FeatureStore


def encode(rows: list[dict], vocab: dict[str, list[str]]) -> np.ndarray:
    """Feature dicts -> float matrix in FEATURES order. Unseen categories map to -1."""
    index = {c: {v: i for i, v in enumerate(vocab[c])} for c in CATEGORICAL}
    X = np.empty((len(rows), len(FEATURES)), dtype=np.float32)
    for r, f in enumerate(rows):
        for j, name in enumerate(FEATURES):
            X[r, j] = index[name].get(f[name], -1) if name in index else f[name]
    return X


@dataclass
class Bundle:
    booster: xgb.Booster
    meta: dict

    @property
    def version(self) -> str:
        return self.meta["version"]

    def predict(self, X: np.ndarray) -> np.ndarray:
        return self.booster.predict(xgb.DMatrix(X, feature_names=FEATURES))

    def contributions(self, X: np.ndarray) -> np.ndarray:
        """Per-feature SHAP values (log-odds), last column is the bias."""
        return self.booster.predict(xgb.DMatrix(X, feature_names=FEATURES), pred_contribs=True)

    def decide(self, score: float) -> str:
        t = self.meta["thresholds"]
        return "BLOCKED" if score >= t["block"] else "FLAGGED" if score >= t["flag"] else "CLEARED"

    def save(self, directory: str) -> None:
        os.makedirs(directory, exist_ok=True)
        self.booster.save_model(os.path.join(directory, "model.json"))
        with open(os.path.join(directory, "bundle.json"), "w") as f:
            json.dump(self.meta, f, indent=2)

    @classmethod
    def load(cls, directory: str) -> "Bundle":
        with open(os.path.join(directory, "bundle.json")) as f:
            meta = json.load(f)
        if meta.get("features") != FEATURES:
            raise ValueError("Bundle feature list does not match this code's FEATURES; retrain.")
        booster = xgb.Booster()
        booster.load_model(os.path.join(directory, "model.json"))
        return cls(booster, meta)


class Scorer:
    """Thread-safe online scoring: point-in-time features -> model -> decision."""

    def __init__(self, bundle: Bundle, store: FeatureStore | None = None, top_k: int = 5):
        self.bundle = bundle
        self.store = store or FeatureStore(bundle.meta["amount_quantiles"])
        self.top_k = top_k
        self.lock = threading.Lock()

    def score(self, tx: dict) -> dict:
        with self.lock:
            feats = self.store.compute(tx)
            self.store.update(tx)
        X = encode([feats], self.bundle.meta["vocab"])
        p = float(self.bundle.predict(X)[0])
        contrib = self.bundle.contributions(X)[0][:-1]
        order = np.argsort(-np.abs(contrib))[: self.top_k]
        return {
            "risk_score": round(p, 4),
            "decision": self.bundle.decide(p),
            "top_factors": [{"feature": FEATURES[i], "value": feats[FEATURES[i]],
                             "contribution": round(float(contrib[i]), 4)} for i in order],
            "features": feats,
        }
