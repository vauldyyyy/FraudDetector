import json
import time
import os
import sys
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, accuracy_score, precision_recall_fscore_support

# Adjust path to import from parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import train_model_v2 as tm

MODEL_DIR = "ml-models"
RESULTS_FILE = "ablation_results.json"

def evaluate_model(y_test, predictions):
    p, r, f1, _ = precision_recall_fscore_support(y_test, predictions, average='binary')
    return p, r, f1

def run_feature_ablation():
    print("--- Running Experiment E2: Feature Group Ablation ---")
    df = tm.load_and_prepare_data()
    if 'timestamp' in df.columns:
        df = df.sort_values('timestamp').reset_index(drop=True)
    
    # Base: amount, category, device, state, bank, hour
    base_features = ['amount', 'category', 'device', 'state', 'bank', 'hour']
    # Temporal: minute, day_of_week, is_night, is_weekend
    temporal_features = ['minute', 'day_of_week', 'is_night', 'is_weekend']
    # Velocity: txn_count_1h, txn_count_24h, minutes_since_last_txn
    velocity_features = ['txn_count_1h', 'txn_count_24h', 'minutes_since_last_txn']
    # Statistical: amount_zscore, amount_vs_median, amount_percentile, is_round_amount
    statistical_features = ['amount_zscore', 'amount_vs_median', 'amount_percentile', 'is_round_amount']
    # Account: account_age_days, is_new_device, is_new_state
    account_features = ['account_age_days', 'is_new_device', 'is_new_state']
    
    stages = [
        ("Base", base_features),
        ("+ Temporal", base_features + temporal_features),
        ("+ Velocity", base_features + temporal_features + velocity_features),
        ("+ Statistical", base_features + temporal_features + velocity_features + statistical_features),
        ("All features", base_features + temporal_features + velocity_features + statistical_features + account_features)
    ]
    
    results = {}
    y = df[tm.TARGET_COL].values
    
    import xgboost as xgb
    
    base_auc = None
    for name, cols in stages:
        print(f"\nTraining subset: {name} ({len(cols)} features)")
        
        # We need to encode the selected columns
        temp_df = df.copy()
        
        # Only encode categorical columns present in cols
        cat_cols = [c for c in cols if c in tm.CATEGORICAL_COLS]
        for col in cat_cols:
            from sklearn.preprocessing import LabelEncoder
            temp_df[col] = LabelEncoder().fit_transform(temp_df[col].astype(str))
            
        X = temp_df[cols].values
        split_idx = int(len(X) * 0.8)
        X_train, X_test = X[:split_idx], X[split_idx:]
        y_train, y_test = y[:split_idx], y[split_idx:]
        
        ratio = len(y_train[y_train == 0]) / max(len(y_train[y_train == 1]), 1)
        model = xgb.XGBClassifier(n_estimators=100, max_depth=6, scale_pos_weight=ratio, random_state=42, n_jobs=-1, eval_metric='logloss')
        
        model.fit(X_train, y_train)
        probs = model.predict_proba(X_test)[:, 1]
        preds = model.predict(X_test)
        
        auc = roc_auc_score(y_test, probs)
        p, r, f1 = evaluate_model(y_test, preds)
        
        delta = 0 if base_auc is None else auc - base_auc
        if base_auc is None:
            base_auc = auc
            
        print(f"AUC: {auc:.4f} | Recall: {r:.4f} | Precision: {p:.4f} | Delta: {delta:+.4f}")
        results[name] = {
            "ROC-AUC": f"{auc:.4f}",
            "Recall": f"{r:.4f}",
            "Precision": f"{p:.4f}",
            "Delta": "--" if name == "Base" else f"{delta:+.4f}"
        }
        
    return results

def run_imbalance_ablation():
    print("\n--- Running Experiment E3: Class Imbalance Handling ---")
    df = tm.load_and_prepare_data()
    if 'timestamp' in df.columns:
        df = df.sort_values('timestamp').reset_index(drop=True)
        
    df, feature_cols, encoders = tm.encode_features(df)
    
    X = df[feature_cols].values
    y = df[tm.TARGET_COL].values
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]
    
    from sklearn.ensemble import RandomForestClassifier
    import imblearn
    from imblearn.over_sampling import SMOTE
    from imblearn.combine import SMOTETomek
    
    methods = [
        ("No balancing", None, None),
        ("Class weights", 'balanced', None),
        ("SMOTE (0.3 ratio)", None, SMOTE(sampling_strategy=0.3, random_state=42)),
        ("SMOTE + Tomek Links", None, SMOTETomek(random_state=42))
    ]
    
    results = {}
    for name, class_weight, sampler in methods:
        print(f"Testing method: {name}")
        
        if sampler is not None:
            X_res, y_res = sampler.fit_resample(X_train, y_train)
        else:
            X_res, y_res = X_train, y_train
            
        model = RandomForestClassifier(n_estimators=100, max_depth=10, class_weight=class_weight, random_state=42, n_jobs=-1)
        model.fit(X_res, y_res)
        
        probs = model.predict_proba(X_test)[:, 1]
        preds = model.predict(X_test)
        
        auc = roc_auc_score(y_test, probs)
        p, r, f1 = evaluate_model(y_test, preds)
        
        cm = tm.confusion_matrix(y_test, preds)
        tn, fp, fn, tp = cm.ravel()
        fpr_val = fp / (fp + tn + 1e-8)
        
        print(f"AUC: {auc:.4f} | Recall: {r:.4f} | FPR: {fpr_val:.4f}")
        results[name] = {
            "ROC-AUC": f"{auc:.4f}",
            "Recall": f"{r:.4f}",
            "FPR": f"{fpr_val:.4f}"
        }
        
    return results

def main():
    if not os.path.exists("datasets/fraudlens_transactions.csv"):
        print("Dataset not found. Please run data generation first.")
        return
        
    e2_results = run_feature_ablation()
    e3_results = run_imbalance_ablation()
    
    with open(RESULTS_FILE, 'w') as f:
        json.dump({
            "E2_FeatureAblation": e2_results,
            "E3_ImbalanceHandling": e3_results
        }, f, indent=2)
        
    print(f"\nSaved ablation results to {RESULTS_FILE}")

if __name__ == '__main__':
    main()
