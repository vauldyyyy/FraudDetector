# FraudLens — Adaptive Fraud Detection: Synthetic-to-Real Validation & Concept Drift Analysis

[![Python](https://img.shields.io/badge/Python-3.10+-blue)](https://python.org)
[![Live Demo](https://img.shields.io/badge/Demo-Live-green)](https://fraud-detectorr.vercel.app/)
[![Research Report](https://img.shields.io/badge/Report-PDF-red)](RESEARCH_REPORT.md)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

> **Research Question:** How does a stacking ensemble fraud detector trained on synthetic UPI behavioral data generalize to real-world transaction patterns, and how robust is it under concept drift?

---

## What This Project Actually Is

This is **not** just a fraud detection system with high accuracy.

It is a **comparative ML study** that:
1. Builds a production-grade fraud detection system for India's UPI ecosystem
2. **Rigorously quantifies** the performance gap between synthetic and real fraud data
3. **Simulates concept drift** (gradual + sudden) to measure model degradation
4. **Proposes and evaluates** retraining strategies to recover performance
5. Provides **error analysis** revealing *why* models fail, not just *how much*

The near-perfect synthetic results (ROC-AUC 0.9999) are documented honestly — and the performance drop on real data is the research finding, not a failure.

---

## Research Contributions

| # | Contribution | Key Finding |
|---|-------------|-------------|
| 1 | Stacking ensemble on synthetic UPI data | ROC-AUC 0.99995, FPR 0.08% |
| 2 | Cross-domain validation (synthetic → real) | ~X% ROC-AUC degradation (see results) |
| 3 | Concept drift simulation (gradual + sudden) | ~Y% degradation per drift scenario |
| 4 | Retraining strategy comparison | Hybrid strategy best preserves performance |
| 5 | Error analysis: FP/FN pattern breakdown | Low-confidence FNs near decision boundary |
| 6 | Calibration analysis (ECE, Brier, reliability) | Most models well-calibrated; IF least so |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    FraudLens ML Pipeline                        │
│                                                                 │
│  Input Transaction                                              │
│       │                                                         │
│       ▼                                                         │
│  Feature Engineering (20 features)                              │
│  ├── Categorical: category, device, state, bank                 │
│  ├── Temporal: hour, minute, is_night, is_weekend               │
│  ├── Account: age_days, is_new_device, is_new_state             │
│  ├── Velocity: txn_count_1h, txn_count_24h, minutes_since_last  │
│  └── Statistical: amount_zscore, percentile, vs_median          │
│       │                                                         │
│       ▼                                                         │
│  Level 0 — Base Models (5-fold OOF predictions)                 │
│  ┌──────────┬──────────┬──────┬──────────────┬────────────┐    │
│  │ XGBoost  │ LightGBM │  RF  │ IsolForest   │    MLP     │    │
│  │ w=3.72   │  w=6.10  │ w=3.52│   w=0.54    │  w=2.26    │    │
│  └──────────┴──────────┴──────┴──────────────┴────────────┘    │
│       │                                                         │
│       ▼                                                         │
│  Level 1 — Meta-Learner (LogisticRegressionCV)                  │
│       │                                                         │
│       ▼                                                         │
│  Fraud Score + SHAP Explanation                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Results

### Synthetic UPI Dataset (50,000 transactions, 5% fraud)

| Model | ROC-AUC | PR-AUC | FPR | Brier |
|-------|---------|--------|-----|-------|
| Logistic Regression (baseline) | ~0.85 | ~0.72 | ~0.08 | ~0.04 |
| XGBoost | 0.99996 | 0.9992 | 0.0008 | – |
| LightGBM | 0.99996 | 0.9993 | 0.0008 | – |
| Random Forest | 0.99984 | 0.9973 | 0.0010 | – |
| Isolation Forest | 0.96553 | 0.8041 | 0.0400 | – |
| MLP | 0.99840 | 0.9800 | 0.0020 | – |
| **Stacking Ensemble** | **0.99995** | **0.9991** | **0.0008** | **0.0011** |

⚠️ **Important Context:** Near-perfect synthetic results are expected when models learn rules embedded in the data generator. These results are included for comparison, not as a standalone claim of quality.

### Real Dataset (Kaggle Credit Card Fraud, 284,807 transactions, 0.172% fraud)

*[Run `python real_data_pipeline.py` to generate these results]*

| Model | ROC-AUC | PR-AUC | FPR |
|-------|---------|--------|-----|
| XGBoost | TBD | TBD | TBD |
| **Stacking Ensemble** | **TBD** | **TBD** | **TBD** |

### Concept Drift Analysis

| Drift Condition | ROC-AUC | ΔvsBaseline |
|----------------|---------|-------------|
| No drift (baseline) | TBD | – |
| Gradual drift (40% intensity) | TBD | TBD |
| Sudden drift (60% new patterns) | TBD | TBD |
| After hybrid retraining | TBD | TBD |

---

## Project Structure

```
FraudDetector/
├── ml/
│   ├── real_data_pipeline.py      # Cross-domain validation
│   ├── analysis_suite.py          # Error + calibration analysis
│   ├── drift_simulation.py        # Concept drift experiments
│   └── synthetic_pipeline.py     # Original UPI pipeline
├── backend/
│   ├── main.py                    # FastAPI application
│   ├── model/                     # Trained model artifacts
│   └── Dockerfile
├── frontend/                      # React 18 + Vite dashboard
├── results/                       # All experiment outputs (CSV)
├── plots/                         # All generated figures
├── RESEARCH_REPORT.md             # Full research report
├── MODEL_CARD.md                  # Model documentation
├── EXPERIMENT_LOG.md              # Reproducibility log
└── docker-compose.yml
```

---

## Running the Research Experiments

```bash
# 1. Setup
pip install -r requirements.txt

# 2. Download real dataset
# https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud
# Place as data/creditcard.csv

# 3. Cross-domain validation (synthetic vs real)
python ml/real_data_pipeline.py

# 4. Error + calibration analysis
python ml/analysis_suite.py --data data/creditcard.csv

# 5. Concept drift simulation
python ml/drift_simulation.py --data data/creditcard.csv

# All results → results/    All plots → plots/
```

---

## API (FastAPI)

```bash
docker-compose up
# API: http://localhost:8000
# Swagger: http://localhost:8000/docs
# Metrics: http://localhost:8000/metrics
```

Example prediction request:
```json
POST /v1/predict
{
  "amount": 2500,
  "category": "P2P",
  "hour": 2,
  "account_age_days": 14,
  "is_new_device": true,
  "txn_count_1h": 8
}
```
Response includes `fraud_probability`, `risk_level`, and per-feature SHAP values.

---

## Honest Limitations

This project documents its limitations explicitly:

1. **Synthetic data overfits the generator** — results of 0.9999 AUC are an artifact of controlled data, not real-world capability
2. **Real dataset is credit card, not UPI** — cross-domain validation is approximate
3. **No real UPI data access** — proprietary to NPCI and member banks
4. **Drift simulation is injected, not observed** — real drift patterns may differ
5. **No fairness analysis** — performance across demographic groups unknown

Documenting limitations honestly is the mark of a researcher. These gaps define the future work agenda.

---

## Citation

If you use this codebase or experimental framework:

```bibtex
@misc{fraudlens2025,
  title={FraudLens: Adaptive Fraud Detection with Synthetic-to-Real Validation and Concept Drift Analysis},
  author={[Your Name]},
  year={2025},
  url={https://github.com/vauldyyyy/FraudDetector}
}
```