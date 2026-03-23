# Model Card: FraudLens Ensemble

## Model Details

| Field | Value |
|---|---|
| **Name** | FraudLens Stacking Ensemble v2.0 |
| **Type** | Binary Classification (Fraud / Legitimate) |
| **Architecture** | 5 base models + Logistic Regression meta-learner |
| **Framework** | scikit-learn, XGBoost, LightGBM |
| **Training Data** | 50,000 synthetic UPI transactions (5% fraud rate) |
| **Features** | 20+ (categorical + numerical + engineered) |
| **Last Updated** | March 2026 |

## Base Models

| Model | Role | Key Hyperparameters |
|---|---|---|
| XGBoost | Primary classifier | Optuna-tuned (max_depth, lr, subsample) |
| LightGBM | Fast secondary classifier | max_depth=7, lr=0.05, leaf-wise |
| Random Forest | Stable baseline | n_estimators=300, class_weight=balanced |
| Isolation Forest | Anomaly detector (unsupervised) | contamination=auto |
| MLP Neural Net | Non-linear pattern capture | (128, 64, 32), ReLU, early stopping |

## Intended Use

- **Primary**: Real-time UPI fraud detection for Indian payment processors
- **Users**: Banks, fintech companies, payment aggregators
- **Scope**: Transactions in INR across Indian banking infrastructure

## Limitations

- Trained on synthetic data; real-world distribution may differ
- Does not account for user behavioral sequences (no RNN/LSTM)
- Isolation Forest less effective on in-distribution fraud patterns
- No graph-based features (transaction networks)

## Ethical Considerations

- **Bias**: Model may show state-level bias due to synthetic data distribution
- **Fairness**: Equal false positive rates across banks/states not guaranteed
- **Privacy**: No PII in training data (all synthetic)
- **Explainability**: SHAP values provided for regulatory transparency

## Evaluation Metrics

Detailed metrics are generated during training and saved to `ml-models/model_stats_v2.json`.

Key metrics tracked:
- ROC-AUC, PR-AUC
- Precision, Recall, F1 at optimal threshold
- False Positive Rate
- KS Statistic
- Brier Score (calibration)
- Precision at 95% Recall
- Confusion Matrix

## Feature Engineering

| Group | Features | Count |
|---|---|---|
| Categorical | category, device, state, bank | 4 |
| Temporal | hour, minute, day_of_week, is_night, is_weekend | 5 |
| Account | account_age_days, is_new_device, is_new_state | 3 |
| Velocity | txn_count_1h, txn_count_24h, minutes_since_last_txn | 3 |
| Statistical | amount_zscore, amount_vs_median, amount_percentile, is_round_amount | 4 |
| Base | amount | 1 |

## How to Reproduce

```bash
python scripts/generate_dataset.py  # Generate dataset
python train_model_v2.py             # Train all models
```
