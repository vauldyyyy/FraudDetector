import os
import sys
import json
import pickle
import numpy as np
import pandas as pd
from sklearn.metrics import recall_score

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import train_model_v2 as tm

MODEL_DIR = "ml-models"

def main():
    print("="*60)
    print("  Zero-Day Adversarial Fraud Injection Stress Test")
    print("="*60)
    
    # 1. Load data
    df = tm.load_and_prepare_data()
    if 'timestamp' in df.columns:
        df = df.sort_values('timestamp').reset_index(drop=True)
    
    # Extract test set
    split_idx = int(len(df) * 0.8)
    df_test = df.iloc[split_idx:].copy()
    
    baseline_test_size = len(df_test)
    print(f"[*] Baseline Test Set Size: {baseline_test_size}")
    
    # 2. Generate 500 'Zero-Day' Adversarial Transactions
    print("\n[*] Injecting 500 'Zero-Day' Social Engineering Transactions...")
    np.random.seed(99)
    zero_day_data = []
    
    base_row = df_test.iloc[0].to_dict()
    for i in range(500):
        row = base_row.copy()
        row['is_fraud'] = 1
        row['amount'] = float(np.random.uniform(50000, 100000))
        row['category'] = 'crypto_exchange'
        row['device'] = 'mobile_ios_new'
        row['state'] = 'International'
        row['is_new_device'] = 1
        row['is_new_state'] = 1
        row['txn_count_1h'] = np.random.randint(10, 30)
        row['txn_count_24h'] = np.random.randint(20, 50)
        row['minutes_since_last_txn'] = 1
        row['is_round_amount'] = 1
        zero_day_data.append(row)
        
    df_zero_day = pd.DataFrame(zero_day_data)
    df_test_injected = pd.concat([df_test, df_zero_day], ignore_index=True)
    
    print(f"[*] New Test Set Size: {len(df_test_injected)}")
    
    # 3. Encode Features
    with open(f"{MODEL_DIR}/label_encoders.pkl", 'rb') as f:
        encoders = pickle.load(f)
        
    for col in tm.CATEGORICAL_COLS:
        if col in encoders:
            le = encoders[col]
            classes = set(le.classes_)
            
            def safe_transform(x):
                return le.transform([str(x) if str(x) in classes else le.classes_[0]])[0]
                
            df_test_injected[col] = df_test_injected[col].apply(safe_transform)
            df_test[col] = df_test[col].apply(safe_transform)
            df_zero_day[col] = df_zero_day[col].apply(safe_transform)

    with open(f"{MODEL_DIR}/feature_config.json", 'r') as f:
        config = json.load(f)
    feature_cols = config['feature_cols']
    
    X_test_base = df_test[feature_cols].values
    y_test_base = df_test[tm.TARGET_COL].values
    
    X_test_inj = df_test_injected[feature_cols].values
    y_test_inj = df_test_injected[tm.TARGET_COL].values
    
    X_zero_day = df_zero_day[feature_cols].values
    y_zero_day = df_zero_day[tm.TARGET_COL].values
    
    # 4. Load Models and Evaluate
    print("\n[*] Loading Ensemble Models...")
    with open(f"{MODEL_DIR}/xgboost.pkl", 'rb') as f: xgb = pickle.load(f)
    with open(f"{MODEL_DIR}/lightgbm.pkl", 'rb') as f: lgbm = pickle.load(f)
    with open(f"{MODEL_DIR}/random_forest.pkl", 'rb') as f: rf = pickle.load(f)
    with open(f"{MODEL_DIR}/isolation_forest.pkl", 'rb') as f: iso = pickle.load(f)
    with open(f"{MODEL_DIR}/neural_net.pkl", 'rb') as f: nn_model = pickle.load(f)
    with open(f"{MODEL_DIR}/scaler.pkl", 'rb') as f: scaler = pickle.load(f)
    with open(f"{MODEL_DIR}/meta_learner.pkl", 'rb') as f: meta_clf = pickle.load(f)
    
    def predict_ensemble(X):
        p_xgb = xgb.predict_proba(X)[:, 1]
        p_lgbm = lgbm.predict_proba(X)[:, 1]
        p_rf = rf.predict_proba(X)[:, 1]
        iso_scores = iso.score_samples(X)
        p_iso = 1 - (iso_scores - iso_scores.min()) / (iso_scores.max() - iso_scores.min() + 1e-8)
        
        X_scaled = scaler.transform(X)
        p_nn = nn_model.predict_proba(X_scaled)[:, 1]
        
        meta_X = np.column_stack([p_iso, p_lgbm, p_nn, p_rf, p_xgb]) 
        return meta_clf.predict_proba(meta_X)[:, 1]
        
    print("\n📊 Evaluating Baseline (Before Injection)...")
    prob_base = predict_ensemble(X_test_base)
    pred_base = (prob_base > 0.5).astype(int)
    recall_base = recall_score(y_test_base, pred_base)
    print(f"   Baseline Recall: {recall_base*100:.2f}%")
    
    print("\n🧨 Evaluating Zero-Day Payload Separately...")
    prob_zd = predict_ensemble(X_zero_day)
    pred_zd = (prob_zd > 0.5).astype(int)
    recall_zd = recall_score(y_zero_day, pred_zd)
    print(f"   Zero-Day Recall: {recall_zd*100:.2f}% (Expected massive drop)")
    
    print("\n📉 Evaluating Fully Injected Test Stream...")
    prob_inj = predict_ensemble(X_test_inj)
    pred_inj = (prob_inj > 0.5).astype(int)
    recall_inj = recall_score(y_test_inj, pred_inj)
    print(f"   Injected Stream Recall: {recall_inj*100:.2f}%")
    print(f"\n✅ Degradation formally measured: {(recall_base - recall_inj)*100:.2f}% absolute drop on entire test set.")

if __name__ == '__main__':
    main()
