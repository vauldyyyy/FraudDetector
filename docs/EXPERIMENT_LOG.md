# Experiment Log

## Experiment E1: Model Ablation Study

**Objective**: Compare individual model performance vs. stacking ensemble.

| Model | ROC-AUC | PR-AUC | F1 | Inference (ms) |
|---|---|---|---|---|
| XGBoost (Optuna) | 0.9999 | 0.9991 | N/A | ~15ms |
| LightGBM | 0.9999 | 0.9992 | N/A | ~2ms |
| Random Forest | 0.9998 | 0.9972 | N/A | ~8ms |
| Isolation Forest | 0.9655 | 0.8041 | N/A | ~1ms |
| Neural Network | 0.9983 | 0.9800 | N/A | ~20ms |
| **Stacking Ensemble** | **0.9999** | **0.9991** | **0.9880** | ~45ms |

> **Instructions**: Run `python train_model_v2.py` and update this table with the output metrics.

---

## Experiment E2: Feature Group Ablation

**Objective**: Measure the impact of each feature group on fraud detection performance.

| Feature Set | ROC-AUC | Recall | Precision | Δ vs. Base |
|---|---|---|---|---|
| Base (amount, category, device, state, bank, hour) | 0.9979 | 0.9760 | 0.8161 | — |
| + Temporal (minute, day_of_week, is_night, is_weekend) | 0.9984 | 0.9740 | 0.8544 | +0.0006 |
| + Velocity (txn_count_1h, txn_count_24h, etc.) | 0.9989 | 0.9700 | 0.8802 | +0.0010 |
| + Statistical (z-score, percentile, etc.) | 0.9996 | 0.9700 | 0.9491 | +0.0017 |
| + Account (age, new_device, new_state) | 1.0000 | 0.9900 | 0.9841 | +0.0021 |
| **All features** | **1.0000** | **0.9900** | **0.9841** | **+0.0021** |

---

## Experiment E3: Class Imbalance Handling

**Objective**: Compare strategies for handling the 5% fraud rate.

| Method | ROC-AUC | Recall | FPR |
|---|---|---|---|
| No balancing | 0.9993 | 0.9280 | 0.0001 |
| Class weights (scale_pos_weight) | 0.9998 | 0.9620 | 0.0013 |
| SMOTE (0.3 ratio) | 0.9995 | 0.9500 | 0.0003 |
| SMOTE + Tomek Links | 0.9996 | 0.9680 | 0.0015 |

---

## Experiment E4: Fraud Type Detection

**Objective**: Evaluate per-fraud-type detection rates.

| Fraud Type | Recall | Precision | F1 | Notes |
|---|---|---|---|---|
| Account Takeover | TBD | TBD | TBD | High amount + night + new device |
| Micro-Splitting | TBD | TBD | TBD | Many tiny amounts |
| Merchant Collusion | TBD | TBD | TBD | Round amounts |
| Social Engineering | TBD | TBD | TBD | P2P + new payee |

---

## How to Fill This Table

1. Run `python train_model_v2.py` — it outputs all metrics
2. Copy the model results from the terminal into the E1 table
3. For E2-E4, modify `train_model_v2.py` to train with subsets of features
4. Or use the Jupyter notebook `notebooks/ablation_study.ipynb` (coming soon)
