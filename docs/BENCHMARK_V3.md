# FraudLens v3 — scoring latency

x86_64 · Python 3.13.17 · single process, sequential requests, feature store warmed with 39,999 transactions.

| path | requests | p50 ms | p95 ms | p99 ms | req/s (1 worker) |
|---|---|---|---|---|---|
| HTTP (FastAPI, in-process, incl. validation + JSON) | 5,000 | 2.95 | 3.30 | 3.64 | 334 |
| Scorer only | 5,000 | 0.45 | 0.56 | 0.91 | 2,153 |

Excludes network. Each request computes point-in-time features, runs XGBoost, and computes SHAP contributions for the top-5 explanation.
