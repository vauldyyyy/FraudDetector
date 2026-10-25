# FraudLens v3 — evaluation

Model `v3-202610252120-d7981174` · data `fraudlens_transactions.csv` (49,999 rows, fraud rate 5.00%, sha256 `d7981174966edf17`)

Time-ordered split (train / valid / test sizes: 34,999 / 5,000 / 10,000). Features are point-in-time: each uses only the same user's earlier transactions.

## Test set (latest 20% of transactions)

| model | ROC-AUC | PR-AUC | recall @ 1% FPR | Brier |
|---|---|---|---|---|
| XGBoost, point-in-time features | 0.9991 | 0.9904 | 0.9842 | 0.0068 |
| Logistic regression baseline | 0.9875 | 0.9375 | 0.9300 | 0.0174 |
| XGBoost on old look-ahead features (leaky) | 0.9977 | 0.9810 | 0.9752 | 0.0091 |

## Decision thresholds (chosen on validation, applied to test)

| decision | threshold | test precision | test recall | alert rate |
|---|---|---|---|---|
| FLAGGED (≥) | 0.1722 | 0.466 | 0.993 | 9.440% |
| BLOCKED (≥) | 0.6645 | 0.958 | 0.977 | 4.520% |

## Recall at the FLAG threshold by fraud pattern

| pattern | test cases | recall |
|---|---|---|
| account_takeover | 124 | 1.000 |
| merchant_collusion | 121 | 1.000 |
| micro_splitting | 88 | 0.966 |
| social_engineering | 110 | 1.000 |

Data are synthetic (scripts/generate_dataset.py); see README for real-data validation.
