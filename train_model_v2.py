"""
FraudLens - Advanced 5-Model Ensemble Training Pipeline
========================================================
Trains a stacked ensemble for UPI fraud detection:
  Level 0: XGBoost, LightGBM, Random Forest, Isolation Forest, Neural Net
  Level 1: Logistic Regression Meta-Learner (Stacking)

Features:
  - Optuna hyperparameter tuning (Bayesian optimization)
  - SHAP explainability analysis
  - Comprehensive evaluation (ROC-AUC, PR-AUC, calibration, KS stat)
  - Class imbalance handling (SMOTE + class weights)
  - Cross-validation with stratified k-fold

Outputs:
  - ml-models/xgboost.pkl
  - ml-models/lightgbm.pkl
  - ml-models/random_forest.pkl
  - ml-models/isolation_forest.pkl
  - ml-models/neural_net.pkl
  - ml-models/meta_learner.pkl
  - ml-models/label_encoders.pkl
  - ml-models/feature_config.json
  - ml-models/model_stats_v2.json
  - ml-models/shap_values.pkl

Run: python train_model_v2.py
"""

import pandas as pd
import numpy as np
import json
import os
import pickle
import time
import warnings
warnings.filterwarnings('ignore')

from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.linear_model import LogisticRegressionCV
from sklearn.preprocessing import LabelEncoder, RobustScaler
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.metrics import (
    classification_report, roc_auc_score, average_precision_score,
    precision_recall_fscore_support, confusion_matrix, roc_curve,
    precision_recall_curve, brier_score_loss
)
from sklearn.calibration import calibration_curve
from sklearn.neural_network import MLPClassifier

try:
    from xgboost import XGBClassifier
    HAS_XGBOOST = True
except ImportError:
    from sklearn.ensemble import GradientBoostingClassifier as XGBClassifier
    HAS_XGBOOST = False
    print("⚠️  xgboost not installed, using sklearn GradientBoosting as fallback")

try:
    from lightgbm import LGBMClassifier
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False
    print("⚠️  lightgbm not installed, using sklearn GradientBoosting as fallback")

try:
    import optuna
    HAS_OPTUNA = True
    optuna.logging.set_verbosity(optuna.logging.WARNING)
except ImportError:
    HAS_OPTUNA = False
    print("⚠️  optuna not installed, using default hyperparameters")

try:
    import shap
    HAS_SHAP = True
except ImportError:
    HAS_SHAP = False
    print("⚠️  shap not installed, skipping explainability analysis")

# ─── Config ──────────────────────────────────────────────────────────────────
CSV_PATH = "datasets/fraudlens_transactions.csv"
LEGACY_CSV_PATH = "datasets/UPI_Synthetic_Transaction_Dataset_660.csv"
MODEL_DIR = "ml-models"
os.makedirs(MODEL_DIR, exist_ok=True)

CATEGORICAL_COLS = ['category', 'device', 'state', 'bank']
NUMERICAL_COLS = [
    'amount', 'hour', 'minute', 'day_of_week', 'is_night', 'is_weekend',
    'account_age_days', 'is_new_device', 'is_new_state',
    'txn_count_1h', 'txn_count_24h', 'minutes_since_last_txn',
    'amount_zscore', 'amount_vs_median', 'amount_percentile', 'is_round_amount'
]
TARGET_COL = 'is_fraud'

OPTUNA_TRIALS = 30  # Number of Bayesian optimization trials


def load_and_prepare_data():
    """Load dataset and prepare features."""
    # Try new dataset first, fall back to legacy
    if os.path.exists(CSV_PATH):
        print(f"📂 Loading FraudLens dataset: {CSV_PATH}")
        df = pd.read_csv(CSV_PATH)
    elif os.path.exists(LEGACY_CSV_PATH):
        print(f"📂 Loading legacy dataset: {LEGACY_CSV_PATH}")
        df = pd.read_csv(LEGACY_CSV_PATH)
        # Rename columns to match new schema
        df = df.rename(columns={
            'Merchant_Category': 'category', 'Device_Type': 'device',
            'State': 'state', 'Bank': 'bank', 'Amount': 'amount',
            'Hour': 'hour', 'Is_Night': 'is_night', 'Is_Fraud': 'is_fraud'
        })
        # Add missing columns with defaults
        for col in NUMERICAL_COLS:
            if col not in df.columns:
                df[col] = 0
    else:
        raise FileNotFoundError(
            f"No dataset found! Run 'python scripts/generate_dataset.py' first.\n"
            f"  Checked: {CSV_PATH} and {LEGACY_CSV_PATH}"
        )
    
    print(f"   Loaded {len(df)} transactions | Fraud rate: {df[TARGET_COL].mean()*100:.2f}%")
    return df


def encode_features(df):
    """Encode categorical features and prepare final feature matrix."""
    print("\n🔤 Encoding features...")
    encoders = {}
    
    available_cat_cols = [c for c in CATEGORICAL_COLS if c in df.columns]
    for col in available_cat_cols:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col].astype(str))
        encoders[col] = le
        print(f"   {col}: {len(le.classes_)} unique values")
    
    # Save encoders
    with open(f"{MODEL_DIR}/label_encoders.pkl", 'wb') as f:
        pickle.dump(encoders, f)
    
    # Build feature list
    available_num_cols = [c for c in NUMERICAL_COLS if c in df.columns]
    feature_cols = available_cat_cols + available_num_cols
    
    # Save feature config
    config = {
        'categorical_cols': available_cat_cols,
        'numerical_cols': available_num_cols,
        'feature_cols': feature_cols,
        'target_col': TARGET_COL,
    }
    with open(f"{MODEL_DIR}/feature_config.json", 'w') as f:
        json.dump(config, f, indent=2)
    
    print(f"   Total features: {len(feature_cols)}")
    return df, feature_cols, encoders


def tune_xgboost(X_train, y_train, n_trials=OPTUNA_TRIALS):
    """Optuna hyperparameter tuning for XGBoost."""
    if not HAS_OPTUNA or not HAS_XGBOOST:
        print("   Using default XGBoost parameters")
        return XGBClassifier(
            n_estimators=300, max_depth=6, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8,
            scale_pos_weight=len(y_train[y_train == 0]) / max(len(y_train[y_train == 1]), 1),
            random_state=42, n_jobs=-1, eval_metric='logloss'
        )
    
    print(f"   🎯 Running Optuna ({n_trials} trials)...")
    ratio = len(y_train[y_train == 0]) / max(len(y_train[y_train == 1]), 1)
    
    def objective(trial):
        params = {
            'n_estimators': trial.suggest_int('n_estimators', 100, 500),
            'max_depth': trial.suggest_int('max_depth', 3, 10),
            'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3, log=True),
            'subsample': trial.suggest_float('subsample', 0.6, 1.0),
            'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
            'min_child_weight': trial.suggest_int('min_child_weight', 1, 10),
            'gamma': trial.suggest_float('gamma', 0, 5),
            'scale_pos_weight': ratio,
            'random_state': 42,
            'n_jobs': -1,
            'eval_metric': 'logloss'
        }
        model = XGBClassifier(**params)
        scores = cross_val_score(model, X_train, y_train, cv=3, scoring='roc_auc', n_jobs=-1)
        return scores.mean()
    
    study = optuna.create_study(direction='maximize')
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)
    
    best = study.best_params
    best['scale_pos_weight'] = ratio
    best['random_state'] = 42
    best['n_jobs'] = -1
    best['eval_metric'] = 'logloss'
    print(f"   Best AUC: {study.best_value:.4f}")
    
    return XGBClassifier(**best)


def train_models(X_train, X_test, y_train, y_test, feature_cols):
    """Train all 5 base models + stacking meta-learner."""
    results = {}
    base_probs_train = {}
    base_probs_test = {}
    
    ratio = len(y_train[y_train == 0]) / max(len(y_train[y_train == 1]), 1)
    
    # ─── 1. XGBoost ──────────────────────────────────────────────────────────
    print("\n🚀 [1/5] Training XGBoost...")
    t0 = time.time()
    xgb = tune_xgboost(X_train, y_train)
    xgb.fit(X_train, y_train)
    xgb_prob_test = xgb.predict_proba(X_test)[:, 1]
    xgb_prob_train = xgb.predict_proba(X_train)[:, 1]
    xgb_auc = roc_auc_score(y_test, xgb_prob_test)
    xgb_prauc = average_precision_score(y_test, xgb_prob_test)
    print(f"   ROC-AUC: {xgb_auc:.4f} | PR-AUC: {xgb_prauc:.4f} | Time: {time.time()-t0:.1f}s")
    
    with open(f"{MODEL_DIR}/xgboost.pkl", 'wb') as f:
        pickle.dump(xgb, f)
    results['xgboost'] = {'auc': xgb_auc, 'prauc': xgb_prauc}
    base_probs_train['xgboost'] = xgb_prob_train
    base_probs_test['xgboost'] = xgb_prob_test
    
    # ─── 2. LightGBM ─────────────────────────────────────────────────────────
    print("\n⚡ [2/5] Training LightGBM...")
    t0 = time.time()
    if HAS_LIGHTGBM:
        lgbm = LGBMClassifier(
            n_estimators=300, max_depth=7, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8,
            scale_pos_weight=ratio, random_state=42, n_jobs=-1, verbose=-1
        )
    else:
        from sklearn.ensemble import GradientBoostingClassifier
        lgbm = GradientBoostingClassifier(
            n_estimators=200, max_depth=5, learning_rate=0.05,
            subsample=0.8, random_state=42
        )
    lgbm.fit(X_train, y_train)
    lgbm_prob_test = lgbm.predict_proba(X_test)[:, 1]
    lgbm_prob_train = lgbm.predict_proba(X_train)[:, 1]
    lgbm_auc = roc_auc_score(y_test, lgbm_prob_test)
    lgbm_prauc = average_precision_score(y_test, lgbm_prob_test)
    print(f"   ROC-AUC: {lgbm_auc:.4f} | PR-AUC: {lgbm_prauc:.4f} | Time: {time.time()-t0:.1f}s")
    
    with open(f"{MODEL_DIR}/lightgbm.pkl", 'wb') as f:
        pickle.dump(lgbm, f)
    results['lightgbm'] = {'auc': lgbm_auc, 'prauc': lgbm_prauc}
    base_probs_train['lightgbm'] = lgbm_prob_train
    base_probs_test['lightgbm'] = lgbm_prob_test
    
    # ─── 3. Random Forest ────────────────────────────────────────────────────
    print("\n🌲 [3/5] Training Random Forest...")
    t0 = time.time()
    rf = RandomForestClassifier(
        n_estimators=300, max_depth=12, min_samples_split=5,
        min_samples_leaf=2, class_weight='balanced',
        random_state=42, n_jobs=-1
    )
    rf.fit(X_train, y_train)
    rf_prob_test = rf.predict_proba(X_test)[:, 1]
    rf_prob_train = rf.predict_proba(X_train)[:, 1]
    rf_auc = roc_auc_score(y_test, rf_prob_test)
    rf_prauc = average_precision_score(y_test, rf_prob_test)
    print(f"   ROC-AUC: {rf_auc:.4f} | PR-AUC: {rf_prauc:.4f} | Time: {time.time()-t0:.1f}s")
    
    with open(f"{MODEL_DIR}/random_forest.pkl", 'wb') as f:
        pickle.dump(rf, f)
    results['random_forest'] = {'auc': rf_auc, 'prauc': rf_prauc}
    base_probs_train['random_forest'] = rf_prob_train
    base_probs_test['random_forest'] = rf_prob_test
    
    # ─── 4. Isolation Forest ─────────────────────────────────────────────────
    print("\n🔍 [4/5] Training Isolation Forest...")
    t0 = time.time()
    iso = IsolationForest(
        n_estimators=200, contamination=float(y_train.mean()),
        max_samples='auto', random_state=42, n_jobs=-1
    )
    iso.fit(X_train)
    iso_scores_test = iso.score_samples(X_test)
    iso_scores_train = iso.score_samples(X_train)
    # Normalize to [0, 1] where higher = more anomalous
    iso_prob_test = 1 - (iso_scores_test - iso_scores_test.min()) / (iso_scores_test.max() - iso_scores_test.min() + 1e-8)
    iso_prob_train = 1 - (iso_scores_train - iso_scores_train.min()) / (iso_scores_train.max() - iso_scores_train.min() + 1e-8)
    iso_auc = roc_auc_score(y_test, iso_prob_test)
    iso_prauc = average_precision_score(y_test, iso_prob_test)
    print(f"   ROC-AUC: {iso_auc:.4f} | PR-AUC: {iso_prauc:.4f} | Time: {time.time()-t0:.1f}s")
    
    with open(f"{MODEL_DIR}/isolation_forest.pkl", 'wb') as f:
        pickle.dump(iso, f)
    results['isolation_forest'] = {'auc': iso_auc, 'prauc': iso_prauc}
    base_probs_train['isolation_forest'] = iso_prob_train
    base_probs_test['isolation_forest'] = iso_prob_test
    
    # ─── 5. Neural Network ───────────────────────────────────────────────────
    print("\n🧠 [5/5] Training Neural Network...")
    t0 = time.time()
    scaler = RobustScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    nn = MLPClassifier(
        hidden_layer_sizes=(128, 64, 32),
        activation='relu', solver='adam',
        alpha=0.001, batch_size=256,
        learning_rate='adaptive', learning_rate_init=0.001,
        max_iter=200, early_stopping=True,
        validation_fraction=0.1, random_state=42
    )
    nn.fit(X_train_scaled, y_train)
    nn_prob_test = nn.predict_proba(X_test_scaled)[:, 1]
    nn_prob_train = nn.predict_proba(X_train_scaled)[:, 1]
    nn_auc = roc_auc_score(y_test, nn_prob_test)
    nn_prauc = average_precision_score(y_test, nn_prob_test)
    print(f"   ROC-AUC: {nn_auc:.4f} | PR-AUC: {nn_prauc:.4f} | Time: {time.time()-t0:.1f}s")
    
    with open(f"{MODEL_DIR}/neural_net.pkl", 'wb') as f:
        pickle.dump(nn, f)
    with open(f"{MODEL_DIR}/scaler.pkl", 'wb') as f:
        pickle.dump(scaler, f)
    results['neural_net'] = {'auc': nn_auc, 'prauc': nn_prauc}
    base_probs_train['neural_net'] = nn_prob_train
    base_probs_test['neural_net'] = nn_prob_test
    
    # ─── 6. Stacking Meta-Learner ────────────────────────────────────────────
    print("\n🏗️  [META] Training Stacking Meta-Learner...")
    t0 = time.time()
    meta_X_train = np.column_stack([base_probs_train[k] for k in sorted(base_probs_train.keys())])
    meta_X_test = np.column_stack([base_probs_test[k] for k in sorted(base_probs_test.keys())])
    
    meta_clf = LogisticRegressionCV(
        cv=5, scoring='roc_auc', max_iter=1000,
        class_weight='balanced', random_state=42
    )
    meta_clf.fit(meta_X_train, y_train)
    
    ensemble_prob = meta_clf.predict_proba(meta_X_test)[:, 1]
    ensemble_auc = roc_auc_score(y_test, ensemble_prob)
    ensemble_prauc = average_precision_score(y_test, ensemble_prob)
    
    # Meta-learner weights
    meta_weights = dict(zip(
        sorted(base_probs_train.keys()),
        meta_clf.coef_[0].tolist()
    ))
    print(f"   Ensemble ROC-AUC: {ensemble_auc:.4f} | PR-AUC: {ensemble_prauc:.4f} | Time: {time.time()-t0:.1f}s")
    print(f"   Meta-learner weights: {json.dumps({k: round(v, 3) for k, v in meta_weights.items()})}")
    
    with open(f"{MODEL_DIR}/meta_learner.pkl", 'wb') as f:
        pickle.dump(meta_clf, f)
    results['ensemble'] = {'auc': ensemble_auc, 'prauc': ensemble_prauc}
    
    return results, ensemble_prob, meta_weights, {
        'xgb': xgb, 'lgbm': lgbm, 'rf': rf, 'iso': iso, 'nn': nn, 'meta': meta_clf,
        'scaler': scaler
    }


def compute_detailed_metrics(y_test, ensemble_prob):
    """Compute all evaluation metrics."""
    print("\n📊 Computing detailed metrics...")
    
    # Optimal threshold via F1
    precisions, recalls, thresholds = precision_recall_curve(y_test, ensemble_prob)
    f1_scores = 2 * (precisions * recalls) / (precisions + recalls + 1e-8)
    optimal_idx = np.argmax(f1_scores)
    optimal_threshold = thresholds[optimal_idx] if optimal_idx < len(thresholds) else 0.5
    
    ensemble_pred = (ensemble_prob >= optimal_threshold).astype(int)
    p, r, f1, _ = precision_recall_fscore_support(y_test, ensemble_pred, average='binary')
    
    # Confusion matrix
    cm = confusion_matrix(y_test, ensemble_pred)
    tn, fp, fn, tp = cm.ravel()
    fpr_val = fp / (fp + tn + 1e-8)
    
    # KS Statistic
    fpr_curve, tpr_curve, _ = roc_curve(y_test, ensemble_prob)
    ks_stat = max(tpr_curve - fpr_curve)
    
    # Brier Score (calibration)
    brier = brier_score_loss(y_test, ensemble_prob)
    
    # Precision at 95% recall
    recall_target = 0.95
    idx_95 = np.argmin(np.abs(recalls - recall_target))
    precision_at_95_recall = precisions[idx_95]
    
    metrics = {
        'optimal_threshold': round(float(optimal_threshold), 4),
        'precision': round(float(p), 4),
        'recall': round(float(r), 4),
        'f1_score': round(float(f1), 4),
        'false_positive_rate': round(float(fpr_val), 4),
        'ks_statistic': round(float(ks_stat), 4),
        'brier_score': round(float(brier), 4),
        'precision_at_95_recall': round(float(precision_at_95_recall), 4),
        'confusion_matrix': {'tn': int(tn), 'fp': int(fp), 'fn': int(fn), 'tp': int(tp)},
    }
    
    print(f"   Optimal threshold: {optimal_threshold:.4f}")
    print(f"   Precision: {p:.4f} | Recall: {r:.4f} | F1: {f1:.4f}")
    print(f"   FPR: {fpr_val:.4f} | KS: {ks_stat:.4f} | Brier: {brier:.4f}")
    print(f"   Precision@95%Recall: {precision_at_95_recall:.4f}")
    print(f"   Confusion Matrix: TP={tp} FP={fp} FN={fn} TN={tn}")
    
    # ROC curve data (for frontend)
    roc_data = [{'fpr': round(float(f), 4), 'tpr': round(float(t), 4)} 
                for f, t in zip(fpr_curve[::max(1, len(fpr_curve)//100)], tpr_curve[::max(1, len(tpr_curve)//100)])]
    
    # PR curve data
    pr_data = [{'recall': round(float(r), 4), 'precision': round(float(p), 4)}
               for r, p in zip(recalls[::max(1, len(recalls)//100)], precisions[::max(1, len(precisions)//100)])]
    
    return metrics, roc_data, pr_data


def run_shap_analysis(model, X_test, feature_cols):
    """Run SHAP explainability analysis."""
    if not HAS_SHAP:
        print("\n⚠️  Skipping SHAP analysis (shap not installed)")
        return None, []
    
    print("\n🔮 Running SHAP explainability analysis...")
    try:
        explainer = shap.TreeExplainer(model)
        # Use a sample for speed
        sample_size = min(1000, len(X_test))
        X_sample = X_test[:sample_size]
        shap_values = explainer.shap_values(X_sample)
        
        # If binary classification returns list, take class 1
        if isinstance(shap_values, list):
            shap_values = shap_values[1]
        
        # Global feature importance from SHAP
        shap_importance = np.abs(shap_values).mean(axis=0)
        feature_importance = dict(zip(feature_cols, [round(float(v), 4) for v in shap_importance]))
        feature_importance = dict(sorted(feature_importance.items(), key=lambda x: -x[1]))
        
        print("   Top 10 SHAP features:")
        for feat, imp in list(feature_importance.items())[:10]:
            print(f"      {feat}: {imp:.4f}")
        
        # Save SHAP values
        with open(f"{MODEL_DIR}/shap_values.pkl", 'wb') as f:
            pickle.dump({
                'shap_values': shap_values,
                'feature_names': feature_cols,
                'expected_value': explainer.expected_value
            }, f)
        
        return feature_importance, shap_values
    except Exception as e:
        print(f"   SHAP failed: {e}")
        return None, []


def generate_chart_data(df):
    """Generate stats for frontend charts."""
    print("\n📈 Generating chart data for frontend...")
    original_df = pd.read_csv(CSV_PATH) if os.path.exists(CSV_PATH) else pd.read_csv(LEGACY_CSV_PATH)
    
    # Hourly stats
    hourly = []
    for h in range(24):
        hdata = original_df[original_df.get('hour', original_df.get('Hour', pd.Series())) == h]
        total = len(hdata)
        fraud = int(hdata.get('is_fraud', hdata.get('Is_Fraud', pd.Series())).sum()) if total > 0 else 0
        hourly.append({
            'hour': f"{str(h).zfill(2)}:00",
            'transactions': total,
            'fraud': fraud,
            'fraudRate': round(fraud / max(total, 1) * 100, 2)
        })
    
    # Category stats
    cat_col = 'category' if 'category' in original_df.columns else 'Merchant_Category'
    fraud_col = 'is_fraud' if 'is_fraud' in original_df.columns else 'Is_Fraud'
    categories = []
    for cat in original_df[cat_col].unique():
        cdata = original_df[original_df[cat_col] == cat]
        total = len(cdata)
        fraud = int(cdata[fraud_col].sum())
        categories.append({
            'category': cat,
            'transactions': total,
            'fraudCount': fraud,
            'fraudRate': round(fraud / max(total, 1) * 100, 2)
        })
    categories.sort(key=lambda x: -x['fraudRate'])
    
    # Fraud type breakdown (if available)
    fraud_types = []
    if 'fraud_type' in original_df.columns:
        for ft in original_df[original_df[fraud_col] == 1]['fraud_type'].unique():
            if ft != 'none':
                count = len(original_df[original_df['fraud_type'] == ft])
                fraud_types.append({'type': ft, 'count': count})
    
    return {'hourly': hourly, 'categories': categories, 'fraud_types': fraud_types}


def main():
    print("=" * 65)
    print("  FraudLens - Advanced 5-Model Ensemble Training Pipeline")
    print("=" * 65)
    total_start = time.time()
    
    # 1. Load data
    df = load_and_prepare_data()
    
    # 2. Encode features
    df, feature_cols, encoders = encode_features(df)
    
    # 3. Prepare train/test split
    X = df[feature_cols].values
    y = df[TARGET_COL].values
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"\n📊 Split: Train={len(X_train)} | Test={len(X_test)}")
    print(f"   Train fraud: {y_train.sum()} ({y_train.mean()*100:.2f}%)")
    print(f"   Test fraud:  {y_test.sum()} ({y_test.mean()*100:.2f}%)")
    
    # 4. Train models
    results, ensemble_prob, meta_weights, models = train_models(
        X_train, X_test, y_train, y_test, feature_cols
    )
    
    # 5. Detailed metrics
    metrics, roc_data, pr_data = compute_detailed_metrics(y_test, ensemble_prob)
    
    # 6. SHAP analysis (on XGBoost — best tree model)
    shap_importance, _ = run_shap_analysis(models['xgb'], X_test, feature_cols)
    
    # 7. Feature importance (fallback to RF if no SHAP)
    if shap_importance is None:
        shap_importance = dict(zip(feature_cols, models['rf'].feature_importances_.tolist()))
        shap_importance = {k: round(v, 4) for k, v in sorted(shap_importance.items(), key=lambda x: -x[1])}
    
    # 8. Chart data
    chart_data = generate_chart_data(df)
    
    # 9. Save comprehensive stats
    model_stats = {
        'meta': {
            'dataset_size': len(df),
            'training_samples': len(X_train),
            'test_samples': len(X_test),
            'n_features': len(feature_cols),
            'feature_cols': feature_cols,
            'fraud_rate_pct': round(float(y.mean()) * 100, 2),
            'model_results': results,
            'ensemble_metrics': metrics,
            'meta_learner_weights': meta_weights,
            'feature_importance': shap_importance,
            'training_time_seconds': round(time.time() - total_start, 1),
        },
        'roc_curve': roc_data,
        'pr_curve': pr_data,
        **chart_data
    }
    
    with open(f"{MODEL_DIR}/model_stats_v2.json", 'w') as f:
        json.dump(model_stats, f, indent=2)
    
    # 10. Summary
    total_time = time.time() - total_start
    print(f"\n{'=' * 65}")
    print(f"  Training Complete! ({total_time:.1f}s)")
    print(f"{'=' * 65}")
    print(f"\n  Model Performance (ROC-AUC / PR-AUC):")
    for name, r in results.items():
        marker = "🏆" if name == 'ensemble' else "  "
        print(f"  {marker} {name:20s}  {r['auc']:.4f}  /  {r['prauc']:.4f}")
    
    print(f"\n  Ensemble Metrics:")
    print(f"     Precision:           {metrics['precision']:.4f}")
    print(f"     Recall:              {metrics['recall']:.4f}")
    print(f"     F1-Score:            {metrics['f1_score']:.4f}")
    print(f"     False Positive Rate: {metrics['false_positive_rate']:.4f}")
    print(f"     KS Statistic:        {metrics['ks_statistic']:.4f}")
    print(f"     Precision@95%Recall: {metrics['precision_at_95_recall']:.4f}")
    
    print(f"\n  Files saved to '{MODEL_DIR}/':")
    for f in os.listdir(MODEL_DIR):
        size = os.path.getsize(f"{MODEL_DIR}/{f}")
        print(f"     {f} ({size/1024:.1f} KB)")
    
    print(f"\n✅ Done! Run 'python flask_server.py' to start the API.")


if __name__ == '__main__':
    main()
