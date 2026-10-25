"""FastAPI scoring service for the v3 model.

    uvicorn fraudlens.service:app --port 8000

POST /v1/score     score one transaction (idempotent per transaction_id)
GET  /v1/model     model version, thresholds, evaluation metrics
GET  /health       liveness + loaded model version
GET  /metrics      request counts, decision counts and latency percentiles
"""
from __future__ import annotations

import os
import threading
import time
from collections import OrderedDict, deque
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .model import Bundle, Scorer

DEFAULT_BUNDLE = os.getenv("FRAUDLENS_BUNDLE",
                           os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml-models",
                                        "fraudlens_v3"))


class Transaction(BaseModel):
    transaction_id: str = Field(min_length=1, max_length=64)
    user_id: str = Field(min_length=1, max_length=64)
    amount: float = Field(gt=0, le=10_000_000, description="INR")
    category: str = Field(min_length=1, max_length=64)
    device: str = Field(min_length=1, max_length=64)
    state: str = Field(min_length=1, max_length=64)
    bank: str = Field(min_length=1, max_length=64)
    timestamp: datetime | None = Field(None, description="ISO-8601; defaults to now (UTC)")
    account_age_days: float = Field(0, ge=0, le=36_500)


class Factor(BaseModel):
    feature: str
    value: float | int | str
    contribution: float


class ScoreResponse(BaseModel):
    transaction_id: str
    risk_score: float
    decision: str
    top_factors: list[Factor]
    model_version: str
    latency_ms: float
    replayed: bool = False


class _Metrics:
    def __init__(self, window=5000):
        self.lock = threading.Lock()
        self.latencies = deque(maxlen=window)
        self.requests = 0
        self.decisions: dict[str, int] = {}

    def record(self, ms: float, decision: str):
        with self.lock:
            self.requests += 1
            self.latencies.append(ms)
            self.decisions[decision] = self.decisions.get(decision, 0) + 1

    def snapshot(self):
        with self.lock:
            lat = sorted(self.latencies)

        def pct(q):
            return round(lat[min(len(lat) - 1, int(q * len(lat)))], 3) if lat else None

        return {"requests": self.requests, "decisions": dict(self.decisions),
                "latency_ms": {"p50": pct(0.50), "p95": pct(0.95), "p99": pct(0.99)}}


def create_app(bundle_dir: str = DEFAULT_BUNDLE, idempotency_size: int = 100_000) -> FastAPI:
    bundle = Bundle.load(bundle_dir)
    scorer = Scorer(bundle)
    seen: OrderedDict[str, dict] = OrderedDict()
    seen_lock = threading.Lock()
    stats = _Metrics()
    app = FastAPI(title="FraudLens scoring API", version=bundle.version)

    @app.get("/health")
    def health():
        return {"status": "ok", "model_version": bundle.version}

    @app.get("/v1/model")
    def model_info():
        m = bundle.meta
        return {"version": m["version"], "features": m["features"], "thresholds": m["thresholds"],
                "metrics": m["metrics"], "data": m["data"], "env": m["env"]}

    @app.get("/metrics")
    def metrics():
        return stats.snapshot()

    @app.post("/v1/score", response_model=ScoreResponse)
    def score(tx: Transaction):
        t0 = time.perf_counter()
        with seen_lock:
            if tx.transaction_id in seen:
                cached = dict(seen[tx.transaction_id])
                seen.move_to_end(tx.transaction_id)
                return ScoreResponse(**cached, replayed=True)
        ts = tx.timestamp or datetime.now(timezone.utc)
        if ts.tzinfo is not None:
            ts = ts.astimezone(timezone.utc).replace(tzinfo=None)
        payload = tx.model_dump()
        payload["timestamp"] = ts
        try:
            result = scorer.score(payload)
        except Exception as e:  # noqa: BLE001
            raise HTTPException(status_code=500, detail=f"scoring failed: {type(e).__name__}") from e
        ms = (time.perf_counter() - t0) * 1000
        body = {"transaction_id": tx.transaction_id, "risk_score": result["risk_score"],
                "decision": result["decision"], "top_factors": result["top_factors"],
                "model_version": bundle.version, "latency_ms": round(ms, 3)}
        with seen_lock:
            seen[tx.transaction_id] = body
            if len(seen) > idempotency_size:
                seen.popitem(last=False)
        stats.record(ms, result["decision"])
        return ScoreResponse(**body)

    app.state.scorer = scorer
    return app


app = create_app() if os.path.exists(os.path.join(DEFAULT_BUNDLE, "bundle.json")) else None
