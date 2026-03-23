# Experiment Log

## Experiment E1: Model Ablation Study

**Objective**: Compare individual model performance vs. stacking ensemble.

| Model | ROC-AUC | PR-AUC | F1 | Inference (ms) |
|---|---|---|---|---|
| XGBoost (Optuna) | TBD | TBD | TBD | TBD |
| LightGBM | TBD | TBD | TBD | TBD |
| Random Forest | TBD | TBD | TBD | TBD |
| Isolation Forest | TBD | TBD | TBD | TBD |
| Neural Network | TBD | TBD | TBD | TBD |
| **Stacking Ensemble** | **TBD** | **TBD** | **TBD** | TBD |

> **Instructions**: Run `python train_model_v2.py` and update this table with the output metrics.

---

## Experiment E2: Feature Group Ablation

**Objective**: Measure the impact of each feature group on fraud detection performance.

| Feature Set | ROC-AUC | Recall | Precision | Δ vs. Base |
|---|---|---|---|---|
| Base (amount, category, device, state, bank, hour) | TBD | TBD | TBD | — |
| + Temporal (minute, day_of_week, is_night, is_weekend) | TBD | TBD | TBD | TBD |
| + Velocity (txn_count_1h, txn_count_24h, etc.) | TBD | TBD | TBD | TBD |
| + Statistical (z-score, percentile, etc.) | TBD | TBD | TBD | TBD |
| + Account (age, new_device, new_state) | TBD | TBD | TBD | TBD |
| **All features** | **TBD** | **TBD** | **TBD** | **TBD** |

---

## Experiment E3: Class Imbalance Handling

**Objective**: Compare strategies for handling the 5% fraud rate.

| Method | ROC-AUC | Recall | FPR |
|---|---|---|---|
| No balancing | TBD | TBD | TBD |
| Class weights (scale_pos_weight) | TBD | TBD | TBD |
| SMOTE (0.3 ratio) | TBD | TBD | TBD |
| SMOTE + Tomek Links | TBD | TBD | TBD |

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
