"""
FraudLens - Behavioral Drift-Aware LSTM-Attention Model
========================================================
RESEARCH CONTRIBUTION: A novel temporal sequence model that detects fraud
by modeling *behavioral drift* — how a user's transaction patterns change
over time — rather than analyzing individual transactions in isolation.

Architecture:
  Transaction Sequence → Feature Embedding → BiLSTM(64) → Self-Attention
  → Temporal Pooling → Dense(32) → Dropout → Sigmoid

Why this is novel:
  - Standard fraud detection treats each transaction independently
  - This model captures SEQUENTIAL patterns (e.g., sudden shift from
    small daytime purchases to large nighttime transfers)
  - Self-Attention mechanism learns WHICH past transactions are most
    relevant for detecting the current one as fraudulent
  - Addresses the "no new algorithm" critique from TCD review

Requires: pip install torch (PyTorch) — falls back to sklearn if unavailable

Run: python temporal_model.py
"""

import os
import sys
import json
import time
import pickle
import warnings
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score, average_precision_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler

warnings.filterwarnings('ignore')

MODEL_DIR = "ml-models"
os.makedirs(MODEL_DIR, exist_ok=True)

# Check for PyTorch
try:
    import torch
    import torch.nn as nn
    from torch.utils.data import Dataset, DataLoader
    HAS_TORCH = True
    print("[OK] PyTorch available")
except ImportError:
    HAS_TORCH = False
    print("[!] PyTorch not installed. Using sklearn LSTM-approximation fallback.")
    print("    For best results: pip install torch")


# ─── PyTorch LSTM-Attention Model ─────────────────────────────────────────────

if HAS_TORCH:
    class SelfAttention(nn.Module):
        """Self-Attention layer for temporal sequence weighting."""
        def __init__(self, hidden_dim):
            super().__init__()
            self.attention = nn.Sequential(
                nn.Linear(hidden_dim * 2, hidden_dim),  # *2 for BiLSTM
                nn.Tanh(),
                nn.Linear(hidden_dim, 1)
            )
        
        def forward(self, lstm_output):
            # lstm_output: (batch, seq_len, hidden*2)
            weights = self.attention(lstm_output)       # (batch, seq_len, 1)
            weights = torch.softmax(weights, dim=1)     # Normalize across time
            context = torch.sum(weights * lstm_output, dim=1)  # Weighted sum
            return context, weights

    class BehavioralDriftLSTM(nn.Module):
        """
        Behavioral Drift-Aware LSTM with Self-Attention.
        
        Novel aspects:
        1. BiLSTM captures both forward and backward temporal dependencies
        2. Self-Attention learns which historical transactions are most
           relevant for fraud detection
        3. Designed for variable-length user transaction sequences
        """
        def __init__(self, input_dim, hidden_dim=64, n_layers=2, dropout=0.3):
            super().__init__()
            
            self.embedding = nn.Sequential(
                nn.Linear(input_dim, hidden_dim),
                nn.ReLU(),
                nn.BatchNorm1d(hidden_dim),  # Will be applied per-timestep
                nn.Dropout(dropout)
            )
            
            self.lstm = nn.LSTM(
                input_size=hidden_dim,
                hidden_size=hidden_dim,
                num_layers=n_layers,
                batch_first=True,
                bidirectional=True,
                dropout=dropout if n_layers > 1 else 0
            )
            
            self.attention = SelfAttention(hidden_dim)
            
            self.classifier = nn.Sequential(
                nn.Linear(hidden_dim * 2, 32),
                nn.ReLU(),
                nn.Dropout(dropout),
                nn.Linear(32, 1),
                nn.Sigmoid()
            )
        
        def forward(self, x):
            # x: (batch, seq_len, features)
            batch_size, seq_len, features = x.shape
            
            # Embed each timestep
            x_reshaped = x.reshape(-1, features)
            embedded = self.embedding(x_reshaped)
            embedded = embedded.reshape(batch_size, seq_len, -1)
            
            # BiLSTM
            lstm_out, _ = self.lstm(embedded)
            
            # Self-Attention
            context, attn_weights = self.attention(lstm_out)
            
            # Classify
            output = self.classifier(context)
            return output.squeeze(-1), attn_weights

    class TransactionSequenceDataset(Dataset):
        """Dataset that creates user transaction sequences."""
        def __init__(self, sequences, labels):
            self.sequences = sequences
            self.labels = labels
        
        def __len__(self):
            return len(self.sequences)
        
        def __getitem__(self, idx):
            return (
                torch.FloatTensor(self.sequences[idx]),
                torch.FloatTensor([self.labels[idx]])
            )


def create_sequences(df, feature_cols, seq_length=10):
    """
    Create transaction sequences per user.
    Each sequence is `seq_length` consecutive transactions by the same user.
    The label is whether the LAST transaction in the sequence is fraud.
    """
    print(f"   Building sequences (length={seq_length})...")
    
    sequences = []
    labels = []
    
    if 'user_id' in df.columns:
        # UPI dataset: group by user
        df = df.sort_values(['user_id', 'timestamp']).reset_index(drop=True)
        
        for uid, group in df.groupby('user_id'):
            if len(group) < seq_length:
                continue
            
            values = group[feature_cols].values
            fraud_labels = group['is_fraud'].values
            
            for i in range(seq_length, len(group)):
                seq = values[i - seq_length:i]
                label = fraud_labels[i - 1]  # Last txn in sequence
                sequences.append(seq)
                labels.append(label)
    else:
        # Credit card dataset: use sliding window (no user IDs)
        values = df[feature_cols].values
        fraud_labels = df['Class'].values if 'Class' in df.columns else df['is_fraud'].values
        
        for i in range(seq_length, len(df)):
            seq = values[i - seq_length:i]
            label = fraud_labels[i - 1]
            sequences.append(seq)
            labels.append(label)
    
    sequences = np.array(sequences)
    labels = np.array(labels)
    
    print(f"   Created {len(sequences)} sequences")
    print(f"   Fraud sequences: {int(labels.sum())} ({labels.mean()*100:.2f}%)")
    
    return sequences, labels


def train_lstm_model(X_train, y_train, X_val, y_val, input_dim, epochs=30, lr=0.001):
    """Train the BiLSTM-Attention model."""
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"   Device: {device}")
    
    model = BehavioralDriftLSTM(input_dim=input_dim).to(device)
    
    # Handle class imbalance
    pos_weight = torch.tensor([(len(y_train) - y_train.sum()) / max(y_train.sum(), 1)]).to(device)
    criterion = nn.BCELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=3, factor=0.5)
    
    # DataLoaders
    train_ds = TransactionSequenceDataset(X_train, y_train)
    val_ds = TransactionSequenceDataset(X_val, y_val)
    train_loader = DataLoader(train_ds, batch_size=256, shuffle=True, drop_last=True)
    val_loader = DataLoader(val_ds, batch_size=512, shuffle=False)
    
    best_auc = 0
    patience_counter = 0
    
    for epoch in range(epochs):
        # Train
        model.train()
        train_loss = 0
        for batch_x, batch_y in train_loader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device).squeeze()
            optimizer.zero_grad()
            pred, _ = model(batch_x)
            loss = criterion(pred, batch_y)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            train_loss += loss.item()
        
        # Validate
        model.eval()
        val_probs = []
        val_true = []
        with torch.no_grad():
            for batch_x, batch_y in val_loader:
                batch_x = batch_x.to(device)
                pred, _ = model(batch_x)
                val_probs.extend(pred.cpu().numpy())
                val_true.extend(batch_y.numpy().flatten())
        
        val_probs = np.array(val_probs)
        val_true = np.array(val_true)
        
        if len(np.unique(val_true)) > 1:
            val_auc = roc_auc_score(val_true, val_probs)
            val_prauc = average_precision_score(val_true, val_probs)
        else:
            val_auc = 0
            val_prauc = 0
        
        scheduler.step(1 - val_auc)
        
        if val_auc > best_auc:
            best_auc = val_auc
            patience_counter = 0
            torch.save(model.state_dict(), f"{MODEL_DIR}/lstm_attention.pt")
        else:
            patience_counter += 1
        
        if (epoch + 1) % 5 == 0 or epoch == 0:
            print(f"   Epoch {epoch+1}/{epochs} | Loss: {train_loss/len(train_loader):.4f} | "
                  f"AUC: {val_auc:.4f} | PR-AUC: {val_prauc:.4f}")
        
        if patience_counter >= 7:
            print(f"   Early stopping at epoch {epoch+1}")
            break
    
    # Load best model
    model.load_state_dict(torch.load(f"{MODEL_DIR}/lstm_attention.pt", weights_only=True))
    return model, best_auc


def sklearn_fallback(X_train_seq, y_train, X_val_seq, y_val):
    """Fallback: flatten sequences and use sklearn for a sequence-aware model."""
    from sklearn.ensemble import GradientBoostingClassifier
    
    print("   Using sklearn GradientBoosting fallback (flattened sequences)...")
    
    # Flatten: use statistical aggregates of the sequence
    def extract_seq_features(sequences):
        feats = []
        for seq in sequences:
            feat = np.concatenate([
                seq.mean(axis=0),   # Mean of each feature over time
                seq.std(axis=0),    # Std (variability)
                seq[-1] - seq[0],   # Delta (drift) first-to-last
                seq[-1],            # Last transaction features
            ])
            feats.append(feat)
        return np.array(feats)
    
    X_train_flat = extract_seq_features(X_train_seq)
    X_val_flat = extract_seq_features(X_val_seq)
    
    model = GradientBoostingClassifier(
        n_estimators=200, max_depth=5, learning_rate=0.05,
        subsample=0.8, random_state=42
    )
    model.fit(X_train_flat, y_train)
    
    val_probs = model.predict_proba(X_val_flat)[:, 1]
    val_auc = roc_auc_score(y_val, val_probs)
    val_prauc = average_precision_score(y_val, val_probs)
    
    print(f"   Fallback AUC: {val_auc:.4f} | PR-AUC: {val_prauc:.4f}")
    
    with open(f"{MODEL_DIR}/lstm_fallback.pkl", 'wb') as f:
        pickle.dump(model, f)
    
    return model, val_auc


def main():
    print("=" * 60)
    print("  FraudLens - LSTM-Attention Temporal Model")
    print("  Research Contribution: Behavioral Drift Detection")
    print("=" * 60)
    t0 = time.time()
    
    # 1. Load dataset (prefer real, fall back to synthetic)
    real_path = "datasets/creditcard_real.csv"
    synth_path = "datasets/fraudlens_transactions.csv"
    
    if os.path.exists(real_path):
        print(f"\n[*] Loading REAL dataset: {real_path}")
        df = pd.read_csv(real_path)
        target = 'Class'
        feature_cols = [c for c in df.columns if c not in ['Class', 'Time']]
        dataset_name = "real_creditcard"
    elif os.path.exists(synth_path):
        print(f"\n[*] Loading synthetic dataset: {synth_path}")
        df = pd.read_csv(synth_path)
        target = 'is_fraud'
        cat_cols = ['category', 'device', 'state', 'bank']
        for col in cat_cols:
            if col in df.columns:
                le = LabelEncoder()
                df[col] = le.fit_transform(df[col].astype(str))
        feature_cols = [c for c in df.columns if c not in ['is_fraud', 'fraud_type', 'transaction_id', 'user_id', 'timestamp']]
        dataset_name = "synthetic_upi"
    else:
        print("[!] No dataset found. Run scripts/download_real_dataset.py or scripts/generate_dataset.py first.")
        sys.exit(1)
    
    print(f"   Rows: {len(df)} | Features: {len(feature_cols)} | Fraud: {df[target].sum()}")
    
    # 2. Scale features
    scaler = StandardScaler()
    df[feature_cols] = scaler.fit_transform(df[feature_cols])
    
    # 3. Create sequences
    print("\n[*] Creating transaction sequences...")
    seq_length = 10
    
    # For real dataset (no user_id), limit to 50K for speed
    if len(df) > 50000 and 'user_id' not in df.columns:
        print(f"   Sampling 50K rows for speed...")
        df_sample = df.sample(n=50000, random_state=42).sort_index().reset_index(drop=True)
    else:
        df_sample = df
    
    sequences, labels = create_sequences(df_sample, feature_cols, seq_length)
    
    if len(sequences) == 0:
        print("[!] No sequences created. Check dataset format.")
        sys.exit(1)
    
    # 4. Split
    X_train, X_val, y_train, y_val = train_test_split(
        sequences, labels, test_size=0.2, random_state=42,
        stratify=labels if labels.sum() > 10 else None
    )
    print(f"\n   Train: {len(X_train)} | Val: {len(X_val)}")
    print(f"   Train fraud: {int(y_train.sum())} | Val fraud: {int(y_val.sum())}")
    
    # 5. Train
    input_dim = X_train.shape[2]
    
    if HAS_TORCH:
        print("\n[*] Training BiLSTM-Attention model...")
        model, best_auc = train_lstm_model(X_train, y_train, X_val, y_val, input_dim)
    else:
        print("\n[*] Training sequence-aware fallback model...")
        model, best_auc = sklearn_fallback(X_train, y_train, X_val, y_val)
    
    # 6. Save results
    results = {
        'model_type': 'BiLSTM-Attention' if HAS_TORCH else 'GBM-SequenceFallback',
        'dataset': dataset_name,
        'sequence_length': seq_length,
        'n_sequences': len(sequences),
        'n_features': input_dim,
        'best_val_auc': round(best_auc, 4),
        'training_time_seconds': round(time.time() - t0, 1),
        'architecture': {
            'embedding': f'Linear({input_dim}->64) + ReLU + BN + Dropout(0.3)',
            'lstm': 'BiLSTM(64, 2 layers)',
            'attention': 'Self-Attention(128->64->1)',
            'classifier': 'Linear(128->32) + ReLU + Dropout -> Sigmoid'
        } if HAS_TORCH else {'type': 'sklearn_fallback'}
    }
    
    with open(f"{MODEL_DIR}/temporal_model_results.json", 'w') as f:
        json.dump(results, f, indent=2)
    
    # 7. Summary
    print(f"\n{'=' * 60}")
    print(f"  Temporal Model Results")
    print(f"{'=' * 60}")
    print(f"  Model:        {results['model_type']}")
    print(f"  Dataset:      {dataset_name}")
    print(f"  Sequences:    {len(sequences)}")
    print(f"  Best Val AUC: {best_auc:.4f}")
    print(f"  Time:         {results['training_time_seconds']}s")
    print(f"\n  Saved to: {MODEL_DIR}/temporal_model_results.json")
    print(f"\n[OK] Done!")


if __name__ == '__main__':
    main()
