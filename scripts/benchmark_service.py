"""Latency benchmark for the v3 scoring path.

Warms the feature store with the train+valid window, then scores the test window
one transaction at a time, (a) through the HTTP app in-process and (b) directly via
the Scorer. Network time is excluded; this measures the service's own cost.

    python scripts/benchmark_service.py [--n 5000]  -> docs/BENCHMARK_V3.md
"""
import argparse
import os
import platform
import statistics
import sys
import time

import pandas as pd
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fraudlens.service import DEFAULT_BUNDLE, create_app  # noqa: E402
from fraudlens.train import RAW_COLS, time_split  # noqa: E402


def pct(xs, q):
    s = sorted(xs)
    return s[min(len(s) - 1, int(q * len(s)))]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="datasets/fraudlens_transactions.csv")
    ap.add_argument("--n", type=int, default=5000)
    ap.add_argument("--out", default="docs/BENCHMARK_V3.md")
    a = ap.parse_args()

    df = pd.read_csv(a.data).sort_values(["timestamp", "transaction_id"], kind="stable")
    recs = df[RAW_COLS].to_dict("records")
    _, va, te = time_split(len(recs))
    warm, test = recs[:va.stop], recs[te][: a.n]

    rows = []
    for mode in ("http", "direct"):
        app = create_app(DEFAULT_BUNDLE)
        scorer = app.state.scorer
        for r in warm:
            scorer.store.update(r)
        client = TestClient(app)
        lat = []
        t_all = time.perf_counter()
        for r in test:
            t0 = time.perf_counter()
            if mode == "http":
                client.post("/v1/score", json=r).raise_for_status()
            else:
                scorer.score(r)
            lat.append((time.perf_counter() - t0) * 1000)
        wall = time.perf_counter() - t_all
        rows.append((mode, len(test), statistics.median(lat), pct(lat, 0.95), pct(lat, 0.99),
                     len(test) / wall))

    lines = ["# FraudLens v3 — scoring latency", "",
             f"{platform.processor() or platform.machine()} · Python {platform.python_version()} · "
             f"single process, sequential requests, feature store warmed with {len(warm):,} transactions.",
             "", "| path | requests | p50 ms | p95 ms | p99 ms | req/s (1 worker) |", "|---|---|---|---|---|---|"]
    for mode, n, p50, p95, p99, rps in rows:
        name = "HTTP (FastAPI, in-process, incl. validation + JSON)" if mode == "http" else "Scorer only"
        lines.append(f"| {name} | {n:,} | {p50:.2f} | {p95:.2f} | {p99:.2f} | {rps:,.0f} |")
    lines += ["", "Excludes network. Each request computes point-in-time features, runs XGBoost, "
                  "and computes SHAP contributions for the top-5 explanation."]
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w") as f:
        f.write("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
