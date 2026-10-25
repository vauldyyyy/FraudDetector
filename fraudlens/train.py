"""Train and evaluate the production model with leak-free features and a time-ordered split.

    python scripts/generate_dataset.py          # datasets/fraudlens_transactions.csv
    python -m fraudlens.train                    # -> ml-models/fraudlens_v3/ + docs/EVALUATION_V3.md

Protocol
--------
1. Sort the transaction log by timestamp; split 70% train / 10% validation / 20% test by time,
   so the model is always evaluated on transactions that happen after everything it saw.
2. Replay the whole log through `FeatureStore` (point-in-time features).
3. Fit XGBoost with early stopping on validation; a logistic-regression baseline for reference.
4. Choose the decision thresholds on validation only:
   - block: lowest score whose validation precision >= 0.95 (blocking a real customer is costly)
   - flag : lowest score whose validation precision >= 0.50 (sent to manual review)
5. Report test metrics once. For comparison, train the same model and split on the
   generator's precomputed look-ahead columns.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import time
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import sklearn
import xgboost as xgb
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (average_precision_score, brier_score_loss, precision_recall_curve,
                             roc_auc_score, roc_curve)
from sklearn.preprocessing import StandardScaler

from .features import CATEGORICAL, FEATURES, NUMERIC, FeatureStore, amount_quantiles
from .model import Bundle, encode

RAW_COLS = ["transaction_id", "user_id", "amount", "category", "device", "state", "bank",
            "timestamp", "account_age_days"]
LEAKY_COLS = ["amount", "hour", "is_night", "is_weekend", "account_age_days", "is_new_device",
              "is_new_state", "txn_count_1h", "txn_count_24h", "minutes_since_last_txn",
              "amount_zscore", "amount_vs_median", "amount_percentile", "is_round_amount"]
PARAMS = dict(objective="binary:logistic", eval_metric="aucpr", max_depth=5, eta=0.05,
              subsample=0.9, colsample_bytree=0.8, min_child_weight=3, reg_lambda=1.0,
              tree_method="hist", seed=42)


def time_split(n: int, train=0.7, valid=0.1):
    a, b = int(n * train), int(n * (train + valid))
    return slice(0, a), slice(a, b), slice(b, n)


def recall_at_fpr(y, p, fpr_target=0.01) -> float:
    fpr, tpr, _ = roc_curve(y, p)
    return float(np.interp(fpr_target, fpr, tpr))


def _lowest_threshold_with_precision(y, p, target) -> float:
    prec, _, thr = precision_recall_curve(y, p)
    ok = np.where(prec[:-1] >= target)[0]
    return float(thr[ok[0]]) if len(ok) else float(thr[-1])


def pick_thresholds(y, p, block_precision=0.95, flag_precision=0.50) -> dict:
    block = _lowest_threshold_with_precision(y, p, block_precision)
    flag = min(_lowest_threshold_with_precision(y, p, flag_precision), block)
    return {"flag": round(flag, 6), "block": round(block, 6),
            "rule": f"block: valid precision>={block_precision}; flag: valid precision>={flag_precision}"}


def at_threshold(y, p, t) -> dict:
    pred = p >= t
    tp = int((pred & (y == 1)).sum())
    fp = int((pred & (y == 0)).sum())
    fn = int((~pred & (y == 1)).sum())
    return {"threshold": round(float(t), 4), "precision": round(tp / max(tp + fp, 1), 4),
            "recall": round(tp / max(tp + fn, 1), 4), "alert_rate": round(float(pred.mean()), 4)}


def evaluate(y, p) -> dict:
    return {"roc_auc": round(float(roc_auc_score(y, p)), 4),
            "pr_auc": round(float(average_precision_score(y, p)), 4),
            "recall_at_1pct_fpr": round(recall_at_fpr(y, p), 4),
            "brier": round(float(brier_score_loss(y, p)), 5),
            "n": int(len(y)), "positives": int(y.sum())}


def fit_xgb(Xtr, ytr, Xva, yva, feature_names, rounds=2000):
    pos = max(ytr.mean(), 1e-6)
    params = dict(PARAMS, scale_pos_weight=float((1 - pos) / pos))
    dtr = xgb.DMatrix(Xtr, label=ytr, feature_names=feature_names)
    dva = xgb.DMatrix(Xva, label=yva, feature_names=feature_names)
    return xgb.train(params, dtr, rounds, evals=[(dva, "valid")], early_stopping_rounds=100,
                     verbose_eval=False)


def predict(b, X, names):
    return b.predict(xgb.DMatrix(X, feature_names=names), iteration_range=(0, b.best_iteration + 1))


def train(csv_path: str, out_dir: str, report_path: str | None = None) -> dict:
    t0 = time.time()
    df = pd.read_csv(csv_path)
    missing = [c for c in RAW_COLS + ["is_fraud"] if c not in df.columns]
    if missing:
        raise ValueError(f"{csv_path} is missing columns {missing}")
    df = df.sort_values(["timestamp", "transaction_id"], kind="stable").reset_index(drop=True)
    y = df["is_fraud"].to_numpy().astype(int)
    tr, va, te = time_split(len(df))

    quantiles = amount_quantiles(df["amount"].iloc[tr])
    store = FeatureStore(quantiles)
    feats = store.replay(df[RAW_COLS].to_dict("records"))
    vocab = {c: sorted({f[c] for f in feats[tr]}) for c in CATEGORICAL}
    X = encode(feats, vocab)

    booster = fit_xgb(X[tr], y[tr], X[va], y[va], FEATURES)
    p_va, p_te = predict(booster, X[va], FEATURES), predict(booster, X[te], FEATURES)
    thresholds = pick_thresholds(y[va], p_va)

    # Baseline: logistic regression on the numeric point-in-time features.
    num_idx = [FEATURES.index(c) for c in NUMERIC]
    scaler = StandardScaler().fit(X[tr][:, num_idx])
    lr = LogisticRegression(max_iter=2000, class_weight="balanced").fit(
        scaler.transform(X[tr][:, num_idx]), y[tr])
    p_lr = lr.predict_proba(scaler.transform(X[te][:, num_idx]))[:, 1]

    # Leakage check: identical model and split on the generator's look-ahead columns.
    leaky = None
    if all(c in df.columns for c in LEAKY_COLS):
        L = df[LEAKY_COLS].to_numpy(dtype=np.float32)
        lb = fit_xgb(L[tr], y[tr], L[va], y[va], LEAKY_COLS)
        leaky = evaluate(y[te], predict(lb, L[te], LEAKY_COLS))

    per_type = {}
    if "fraud_type" in df.columns:
        ft = df["fraud_type"].iloc[te].to_numpy()
        for kind in sorted(set(ft) - {"none"}):
            m = ft == kind
            per_type[kind] = {"n": int(m.sum()),
                              "recall_at_flag": round(float((p_te[m] >= thresholds["flag"]).mean()), 4)}

    # Keep only the trees early stopping selected.
    final = booster[: booster.best_iteration + 1]
    metrics = {
        "test": evaluate(y[te], p_te),
        "test_at_flag": at_threshold(y[te], p_te, thresholds["flag"]),
        "test_at_block": at_threshold(y[te], p_te, thresholds["block"]),
        "baseline_logreg_test": evaluate(y[te], p_lr),
        "leaky_features_test": leaky,
        "recall_by_fraud_type": per_type,
        "valid": evaluate(y[va], p_va),
    }
    with open(csv_path, "rb") as f:
        data_hash = hashlib.sha256(f.read()).hexdigest()[:16]
    split_times = [str(df["timestamp"].iloc[s.start]) for s in (tr, va, te)]
    meta = {
        "version": f"v3-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}-{data_hash[:8]}",
        "features": FEATURES, "vocab": vocab, "amount_quantiles": quantiles,
        "thresholds": thresholds, "metrics": metrics,
        "data": {"path": os.path.basename(csv_path), "sha256_16": data_hash, "rows": len(df),
                 "fraud_rate": round(float(y.mean()), 4),
                 "split_starts": dict(zip(["train", "valid", "test"], split_times)),
                 "split_sizes": [tr.stop, va.stop - va.start, te.stop - te.start]},
        "training": {"params": PARAMS, "best_iteration": int(booster.best_iteration),
                     "seconds": round(time.time() - t0, 1)},
        "env": {"python": platform.python_version(), "xgboost": xgb.__version__,
                "sklearn": sklearn.__version__},
    }
    Bundle(final, meta).save(out_dir)
    if report_path:
        write_report(meta, report_path)
    return meta


def write_report(meta: dict, path: str) -> None:
    m = meta["metrics"]

    def row(name, d):
        return (f"| {name} | {d['roc_auc']:.4f} | {d['pr_auc']:.4f} | "
                f"{d['recall_at_1pct_fpr']:.4f} | {d['brier']:.4f} |")

    lines = [
        "# FraudLens v3 — evaluation", "",
        f"Model `{meta['version']}` · data `{meta['data']['path']}` "
        f"({meta['data']['rows']:,} rows, fraud rate {meta['data']['fraud_rate']:.2%}, "
        f"sha256 `{meta['data']['sha256_16']}`)", "",
        "Time-ordered split (train / valid / test sizes: "
        + " / ".join(f"{s:,}" for s in meta["data"]["split_sizes"]) + "). "
        "Features are point-in-time: each uses only the same user's earlier transactions.", "",
        "## Test set (latest 20% of transactions)", "",
        "| model | ROC-AUC | PR-AUC | recall @ 1% FPR | Brier |", "|---|---|---|---|---|",
        row("XGBoost, point-in-time features", m["test"]),
        row("Logistic regression baseline", m["baseline_logreg_test"]),
    ]
    if m.get("leaky_features_test"):
        lines.append(row("XGBoost on generator precomputed features (look-ahead, not servable)", m["leaky_features_test"]))
    t = meta["thresholds"]
    lines += ["", "## Decision thresholds (chosen on validation, applied to test)", "",
              "| decision | threshold | test precision | test recall | alert rate |", "|---|---|---|---|---|",
              f"| FLAGGED (≥) | {t['flag']:.4f} | {m['test_at_flag']['precision']:.3f} | "
              f"{m['test_at_flag']['recall']:.3f} | {m['test_at_flag']['alert_rate']:.3%} |",
              f"| BLOCKED (≥) | {t['block']:.4f} | {m['test_at_block']['precision']:.3f} | "
              f"{m['test_at_block']['recall']:.3f} | {m['test_at_block']['alert_rate']:.3%} |", ""]
    if m["recall_by_fraud_type"]:
        lines += ["## Recall at the FLAG threshold by fraud pattern", "", "| pattern | test cases | recall |",
                  "|---|---|---|"]
        lines += [f"| {k} | {v['n']} | {v['recall_at_flag']:.3f} |" for k, v in m["recall_by_fraud_type"].items()]
        lines.append("")
    lines += ["Data are synthetic (scripts/generate_dataset.py); see README for real-data validation."]
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="datasets/fraudlens_transactions.csv")
    ap.add_argument("--out", default="ml-models/fraudlens_v3")
    ap.add_argument("--report", default="docs/EVALUATION_V3.md")
    a = ap.parse_args(argv)
    meta = train(a.data, a.out, a.report)
    print(json.dumps(meta["metrics"], indent=2))
    print(f"Saved {a.out} ({meta['version']}); report {a.report}")


if __name__ == "__main__":
    main()
