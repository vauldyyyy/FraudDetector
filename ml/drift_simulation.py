import os
import pandas as pd
import numpy as np
from sklearn.metrics import roc_auc_score
import xgboost as xgb

def run_drift_simulation():
    data_path = "../datasets/creditcard_real.csv"
    if not os.path.exists(data_path):
        data_path = "datasets/creditcard_real.csv"
        
    if not os.path.exists(data_path):
        print("Dataset missing.")
        return
        
    df = pd.read_csv(data_path)
    df = df.sort_values('Time').reset_index(drop=True)
    split_idx = int(len(df) * 0.8)
    
    test_df = df.iloc[split_idx:].copy()
    features = [c for c in df.columns if c not in ['Class', 'Time']]
    target = 'Class'
    
    y_test = test_df[target].values
    
    train_df = df.iloc[:split_idx]
    X_train = train_df[features].values
    y_train = train_df[target].values
    
    model = xgb.XGBClassifier(n_estimators=50, eval_metric='logloss', random_state=42)
    model.fit(X_train, y_train)
    
    # 1. Baseline No Drift
    base_probs = model.predict_proba(test_df[features].values)[:, 1]
    base_roc = roc_auc_score(y_test, base_probs)
    
    # 2. Gradual Drift (40% Intensity)
    np.random.seed(42)
    gradual_df = test_df.copy()
    gradual_df.loc[gradual_df['Class'] == 0, 'V1'] += np.random.normal(0.5, 0.5, size=(y_test == 0).sum())
    gradual_df.loc[gradual_df['Class'] == 1, 'V2'] -= np.random.normal(1.0, 0.5, size=(y_test == 1).sum())
    
    gradual_probs = model.predict_proba(gradual_df[features].values)[:, 1]
    gradual_roc = roc_auc_score(y_test, gradual_probs)
    
    # 3. Sudden Drift (60% New Patterns)
    sudden_df = test_df.copy()
    fraud_indices = np.where(y_test == 1)[0]
    sudden_fraud_indices = np.random.choice(fraud_indices, size=int(len(fraud_indices)*0.6), replace=False)
    
    for idx in sudden_fraud_indices:
        sudden_df.iloc[idx, sudden_df.columns.get_loc('V14')] = 0.0
        sudden_df.iloc[idx, sudden_df.columns.get_loc('V17')] = 0.0
        
    sudden_probs = model.predict_proba(sudden_df[features].values)[:, 1]
    sudden_roc = roc_auc_score(y_test, sudden_probs)
    
    # 4. Retraining Strategy (Hybrid)
    retrain_idx = int(len(sudden_df) * 0.2)
    new_X_train = np.vstack((X_train, sudden_df[features].values[:retrain_idx]))
    new_y_train = np.concatenate((y_train, y_test[:retrain_idx]))
    
    retrained_model = xgb.XGBClassifier(n_estimators=50, eval_metric='logloss', random_state=42)
    retrained_model.fit(new_X_train, new_y_train)
    
    retrained_probs = retrained_model.predict_proba(sudden_df[features].values[retrain_idx:])[:, 1]
    retrain_roc = roc_auc_score(y_test[retrain_idx:], retrained_probs)
    
    print("--- Concept Drift Analysis (Real Credit Card Data) ---")
    print(f"Baseline (No Drift):   ROC-AUC = {base_roc:.4f}")
    print(f"Gradual Drift (40%):   ROC-AUC = {gradual_roc:.4f} (Drop: {gradual_roc - base_roc:+.4f})")
    print(f"Sudden Drift (60%):    ROC-AUC = {sudden_roc:.4f} (Drop: {sudden_roc - base_roc:+.4f})")
    print(f"Hybrid Retraining:     ROC-AUC = {retrain_roc:.4f} (Recovery vs Sudden: {retrain_roc - sudden_roc:+.4f})")
    
if __name__ == '__main__':
    run_drift_simulation()
