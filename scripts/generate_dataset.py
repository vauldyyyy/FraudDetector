"""
FraudLens - Synthetic UPI Transaction Dataset Generator
========================================================
Generates a realistic large-scale UPI transaction dataset with 4 fraud patterns:
  1. Account Takeover  - High-value night transactions from new devices
  2. Micro-Splitting   - Many tiny transactions in rapid bursts
  3. Merchant Collusion - Round amounts to specific merchants
  4. Social Engineering - Medium-high amounts to new payees

Outputs: datasets/fraudlens_transactions.csv  (50K+ rows, 20+ columns)

Run: python scripts/generate_dataset.py
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
import os
import sys

np.random.seed(42)
random.seed(42)

# ─── Configuration ────────────────────────────────────────────────────────────
OUTPUT_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "datasets", "fraudlens_transactions.csv")
N_LEGIT = 47500
N_FRAUD = 2500  # ~5% fraud rate (realistic for UPI)
N_USERS = 5000

# ─── Realistic Indian UPI Distributions ───────────────────────────────────────
STATES = {
    'Maharashtra': 0.16, 'Karnataka': 0.12, 'Tamil Nadu': 0.10, 'Delhi': 0.09,
    'Uttar Pradesh': 0.08, 'Gujarat': 0.07, 'West Bengal': 0.07, 'Kerala': 0.06,
    'Rajasthan': 0.06, 'Telangana': 0.05, 'Madhya Pradesh': 0.04, 'Bihar': 0.03,
    'Punjab': 0.03, 'Haryana': 0.02, 'Andhra Pradesh': 0.02
}

BANKS = {
    'SBI': 0.18, 'HDFC Bank': 0.14, 'ICICI Bank': 0.12, 'Axis Bank': 0.10,
    'Kotak Mahindra': 0.08, 'Punjab National Bank': 0.07, 'Bank of Baroda': 0.06,
    'Union Bank': 0.06, 'Canara Bank': 0.05, 'IndusInd Bank': 0.04,
    'Yes Bank': 0.04, 'IDBI Bank': 0.03, 'Federal Bank': 0.03
}

DEVICES = {
    'iPhone 14': 0.12, 'iPhone 15': 0.08, 'Samsung Galaxy S23': 0.14,
    'Samsung Galaxy A54': 0.10, 'OnePlus 11': 0.09, 'Redmi Note 12': 0.12,
    'Oppo Reno 10': 0.08, 'Vivo V27': 0.10, 'Google Pixel 7': 0.06,
    'Realme 11 Pro': 0.05, 'Motorola Edge 40': 0.03, 'Nothing Phone 2': 0.03
}

CATEGORIES = {
    'Retail': 0.18, 'E-commerce': 0.16, 'Food & Dining': 0.14,
    'Utility Bills': 0.12, 'Healthcare': 0.08, 'Education': 0.07,
    'Travel': 0.07, 'Entertainment': 0.06, 'Gas Station': 0.05,
    'P2P Transfer': 0.04, 'Insurance': 0.02, 'Investment': 0.01
}

# Amount distributions by category (mean, std) in INR
AMOUNT_DIST = {
    'Retail': (1500, 2000), 'E-commerce': (2500, 3500), 'Food & Dining': (450, 500),
    'Utility Bills': (2000, 1500), 'Healthcare': (3000, 4000), 'Education': (5000, 8000),
    'Travel': (4000, 6000), 'Entertainment': (500, 800), 'Gas Station': (1200, 800),
    'P2P Transfer': (2000, 5000), 'Insurance': (8000, 5000), 'Investment': (15000, 20000)
}


def weighted_choice(dist: dict) -> str:
    """Pick from a weighted distribution dict."""
    items = list(dist.keys())
    weights = list(dist.values())
    return random.choices(items, weights=weights, k=1)[0]


def generate_user_profiles(n_users: int) -> pd.DataFrame:
    """Create realistic user profiles with behavioral baselines."""
    users = []
    for i in range(n_users):
        uid = f"USR{str(i).zfill(6)}"
        home_state = weighted_choice(STATES)
        primary_bank = weighted_choice(BANKS)
        primary_device = weighted_choice(DEVICES)
        # User's typical transaction behavior
        avg_amount = np.random.lognormal(mean=7, sigma=0.8)  # ~₹1000 median
        avg_amount = min(max(avg_amount, 50), 50000)
        txn_frequency = np.random.poisson(lam=3) + 1  # txns per day
        active_hours = sorted(random.sample(range(7, 23), k=random.randint(4, 10)))
        
        users.append({
            'user_id': uid,
            'home_state': home_state,
            'primary_bank': primary_bank,
            'primary_device': primary_device,
            'avg_amount': round(avg_amount, 2),
            'txn_frequency': txn_frequency,
            'active_hours': active_hours,
            'account_age_days': random.randint(30, 1800),
        })
    return pd.DataFrame(users)


def generate_legitimate_transactions(users: pd.DataFrame, n: int) -> list:
    """Generate realistic legitimate UPI transactions."""
    transactions = []
    base_time = datetime(2025, 1, 1)
    
    for i in range(n):
        user = users.iloc[random.randint(0, len(users) - 1)]
        
        # Time: biased toward user's active hours
        day_offset = random.randint(0, 180)
        if random.random() < 0.85:
            hour = random.choice(user['active_hours'])
        else:
            hour = random.randint(0, 23)
        minute = random.randint(0, 59)
        second = random.randint(0, 59)
        timestamp = base_time + timedelta(days=day_offset, hours=hour, minutes=minute, seconds=second)
        
        # Category
        category = weighted_choice(CATEGORIES)
        
        # Amount: based on category distribution + user baseline
        cat_mean, cat_std = AMOUNT_DIST[category]
        amount = abs(np.random.normal(cat_mean, cat_std))
        # Slight adjustment based on user profile
        amount *= (user['avg_amount'] / 1500)  
        amount = max(1, min(round(amount, 2), 500000))
        
        # Device: mostly primary, sometimes different
        if random.random() < 0.90:
            device = user['primary_device']
        else:
            device = weighted_choice(DEVICES)
        
        # State: mostly home state
        if random.random() < 0.92:
            state = user['home_state']
        else:
            state = weighted_choice(STATES)
        
        # Bank: mostly primary
        if random.random() < 0.95:
            bank = user['primary_bank']
        else:
            bank = weighted_choice(BANKS)
        
        is_night = 1 if (hour >= 22 or hour <= 5) else 0
        is_weekend = 1 if timestamp.weekday() >= 5 else 0
        
        transactions.append({
            'transaction_id': f"TXN{str(i).zfill(8)}",
            'user_id': user['user_id'],
            'amount': amount,
            'category': category,
            'device': device,
            'state': state,
            'bank': bank,
            'timestamp': timestamp.isoformat(),
            'hour': hour,
            'minute': minute,
            'day_of_week': timestamp.weekday(),
            'is_night': is_night,
            'is_weekend': is_weekend,
            'account_age_days': user['account_age_days'],
            'is_new_device': 0,
            'is_new_state': 0,
            'is_fraud': 0,
            'fraud_type': 'none',
        })
    
    return transactions


def inject_account_takeover(users: pd.DataFrame, n: int) -> list:
    """
    Account Takeover Fraud:
    - High-value transactions (₹50K-₹500K)
    - Often at night (22:00-04:00)
    - New device + different state
    - Rapid succession (multiple txns within minutes)
    """
    transactions = []
    base_time = datetime(2025, 1, 1)
    
    for i in range(n):
        user = users.iloc[random.randint(0, len(users) - 1)]
        day_offset = random.randint(0, 180)
        hour = random.choice([0, 1, 2, 3, 22, 23])
        
        amount = np.random.uniform(50000, 450000)
        amount = round(amount, 2)
        
        # Different device and state than usual
        device = weighted_choice(DEVICES)
        while device == user['primary_device']:
            device = weighted_choice(DEVICES)
        
        state = weighted_choice(STATES)
        while state == user['home_state']:
            state = weighted_choice(STATES)
        
        timestamp = base_time + timedelta(days=day_offset, hours=hour, minutes=random.randint(0, 59))
        category = random.choice(['P2P Transfer', 'E-commerce', 'Investment'])
        
        transactions.append({
            'transaction_id': f"TXN_ATO_{str(i).zfill(6)}",
            'user_id': user['user_id'],
            'amount': amount,
            'category': category,
            'device': device,
            'state': state,
            'bank': user['primary_bank'],
            'timestamp': timestamp.isoformat(),
            'hour': hour,
            'minute': random.randint(0, 59),
            'day_of_week': timestamp.weekday(),
            'is_night': 1,
            'is_weekend': 1 if timestamp.weekday() >= 5 else 0,
            'account_age_days': user['account_age_days'],
            'is_new_device': 1,
            'is_new_state': 1,
            'is_fraud': 1,
            'fraud_type': 'account_takeover',
        })
    
    return transactions


def inject_micro_splitting(users: pd.DataFrame, n: int) -> list:
    """
    Micro-Splitting Fraud:
    - Many tiny transactions (₹1-₹499) in rapid bursts
    - Same merchant category
    - Short time intervals between transactions
    """
    transactions = []
    base_time = datetime(2025, 1, 1)
    bursts = n // 8  # Each burst is ~8 tiny transactions
    
    for b in range(bursts):
        user = users.iloc[random.randint(0, len(users) - 1)]
        day_offset = random.randint(0, 180)
        hour = random.randint(8, 20)
        category = random.choice(['E-commerce', 'Retail', 'P2P Transfer'])
        
        for t in range(8):
            amount = np.random.uniform(10, 499)
            amount = round(amount, 2)
            minute = random.randint(0, 5) + t * 2  # Transactions within ~20 min window
            
            timestamp = base_time + timedelta(days=day_offset, hours=hour, minutes=min(minute, 59))
            
            transactions.append({
                'transaction_id': f"TXN_MS_{str(b * 8 + t).zfill(6)}",
                'user_id': user['user_id'],
                'amount': amount,
                'category': category,
                'device': user['primary_device'],
                'state': user['home_state'],
                'bank': user['primary_bank'],
                'timestamp': timestamp.isoformat(),
                'hour': hour,
                'minute': min(minute, 59),
                'day_of_week': timestamp.weekday(),
                'is_night': 0,
                'is_weekend': 1 if timestamp.weekday() >= 5 else 0,
                'account_age_days': user['account_age_days'],
                'is_new_device': 0,
                'is_new_state': 0,
                'is_fraud': 1,
                'fraud_type': 'micro_splitting',
            })
    
    return transactions


def inject_merchant_collusion(users: pd.DataFrame, n: int) -> list:
    """
    Merchant Collusion Fraud:
    - Round amounts (₹5000, ₹10000, ₹15000, etc.)
    - Specific merchant categories (Gas Station, Retail)
    - Repeated same-amount transactions
    """
    transactions = []
    base_time = datetime(2025, 1, 1)
    round_amounts = [5000, 10000, 15000, 20000, 25000, 30000, 50000]
    
    for i in range(n):
        user = users.iloc[random.randint(0, len(users) - 1)]
        day_offset = random.randint(0, 180)
        hour = random.randint(10, 18)
        
        amount = random.choice(round_amounts)
        category = random.choice(['Gas Station', 'Retail', 'Healthcare'])
        
        timestamp = base_time + timedelta(days=day_offset, hours=hour, minutes=random.randint(0, 59))
        
        transactions.append({
            'transaction_id': f"TXN_MC_{str(i).zfill(6)}",
            'user_id': user['user_id'],
            'amount': float(amount),
            'category': category,
            'device': user['primary_device'],
            'state': user['home_state'],
            'bank': user['primary_bank'],
            'timestamp': timestamp.isoformat(),
            'hour': hour,
            'minute': random.randint(0, 59),
            'day_of_week': timestamp.weekday(),
            'is_night': 0,
            'is_weekend': 1 if timestamp.weekday() >= 5 else 0,
            'account_age_days': user['account_age_days'],
            'is_new_device': 0,
            'is_new_state': 0,
            'is_fraud': 1,
            'fraud_type': 'merchant_collusion',
        })
    
    return transactions


def inject_social_engineering(users: pd.DataFrame, n: int) -> list:
    """
    Social Engineering Fraud:
    - Medium-high amounts (₹5000–₹100000)
    - New payee (P2P Transfer)
    - Often from less tech-savvy demographics (Bihar, UP, MP)
    - Account age < 90 days more susceptible
    """
    transactions = []
    base_time = datetime(2025, 1, 1)
    
    for i in range(n):
        user = users.iloc[random.randint(0, len(users) - 1)]
        day_offset = random.randint(0, 180)
        hour = random.randint(9, 21)
        
        amount = np.random.uniform(5000, 100000)
        amount = round(amount, 2)
        
        timestamp = base_time + timedelta(days=day_offset, hours=hour, minutes=random.randint(0, 59))
        
        transactions.append({
            'transaction_id': f"TXN_SE_{str(i).zfill(6)}",
            'user_id': user['user_id'],
            'amount': amount,
            'category': 'P2P Transfer',
            'device': user['primary_device'],
            'state': user['home_state'],
            'bank': user['primary_bank'],
            'timestamp': timestamp.isoformat(),
            'hour': hour,
            'minute': random.randint(0, 59),
            'day_of_week': timestamp.weekday(),
            'is_night': 0,
            'is_weekend': 1 if timestamp.weekday() >= 5 else 0,
            'account_age_days': min(user['account_age_days'], random.randint(5, 90)),
            'is_new_device': 0,
            'is_new_state': 0,
            'is_fraud': 1,
            'fraud_type': 'social_engineering',
        })
    
    return transactions


def add_velocity_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add velocity-based features computed per user."""
    print("   ⚡ Computing velocity features...")
    df = df.sort_values(['user_id', 'timestamp']).reset_index(drop=True)
    
    # Per-user rolling features
    df['txn_count_1h'] = 0
    df['txn_count_24h'] = 0
    df['amount_sum_24h'] = 0.0
    df['minutes_since_last_txn'] = 999.0
    df['unique_merchants_24h'] = 1
    
    # Group by user and compute rolling stats
    for uid, group in df.groupby('user_id'):
        indices = group.index.tolist()
        timestamps = pd.to_datetime(group['timestamp'])
        
        for i, idx in enumerate(indices):
            ts = timestamps.iloc[i]
            
            # Count transactions in last 1 hour and 24 hours
            mask_1h = (timestamps.iloc[:i] >= ts - timedelta(hours=1)) & (timestamps.iloc[:i] < ts)
            mask_24h = (timestamps.iloc[:i] >= ts - timedelta(hours=24)) & (timestamps.iloc[:i] < ts)
            
            df.at[idx, 'txn_count_1h'] = int(mask_1h.sum())
            df.at[idx, 'txn_count_24h'] = int(mask_24h.sum())
            df.at[idx, 'amount_sum_24h'] = float(group.loc[indices[:i]].loc[mask_24h[mask_24h].index, 'amount'].sum()) if mask_24h.sum() > 0 else 0
            
            if i > 0:
                time_diff = (ts - timestamps.iloc[i - 1]).total_seconds() / 60
                df.at[idx, 'minutes_since_last_txn'] = round(min(time_diff, 999), 2)
            
            if mask_24h.sum() > 0:
                df.at[idx, 'unique_merchants_24h'] = int(group.loc[indices[:i]].loc[mask_24h[mask_24h].index, 'category'].nunique())
    
    return df


def add_statistical_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add statistical deviation features."""
    print("   📊 Computing statistical features...")
    
    # Per-user amount statistics
    user_stats = df.groupby('user_id')['amount'].agg(['mean', 'std', 'median']).reset_index()
    user_stats.columns = ['user_id', 'user_avg_amount', 'user_std_amount', 'user_median_amount']
    user_stats['user_std_amount'] = user_stats['user_std_amount'].fillna(1)
    
    df = df.merge(user_stats, on='user_id', how='left')
    
    # Z-score relative to user's own history
    df['amount_zscore'] = (df['amount'] - df['user_avg_amount']) / df['user_std_amount'].clip(lower=1)
    df['amount_zscore'] = df['amount_zscore'].clip(-5, 5).round(3)
    
    # Ratio vs user median
    df['amount_vs_median'] = (df['amount'] / df['user_median_amount'].clip(lower=1)).round(3)
    
    # Global percentile
    df['amount_percentile'] = df['amount'].rank(pct=True).round(3)
    
    # Is round amount (fraud signal)
    df['is_round_amount'] = ((df['amount'] % 1000 == 0) & (df['amount'] >= 5000)).astype(int)
    
    # Clean up intermediate columns
    df = df.drop(columns=['user_avg_amount', 'user_std_amount', 'user_median_amount'])
    
    return df


def main():
    print("=" * 60)
    print("  FraudLens - Synthetic UPI Dataset Generator")
    print("=" * 60)
    
    # 1. Generate user profiles
    print(f"\n👤 Generating {N_USERS} user profiles...")
    users = generate_user_profiles(N_USERS)
    print(f"   States: {users['home_state'].nunique()} | Banks: {users['primary_bank'].nunique()}")
    
    # 2. Generate legitimate transactions
    print(f"\n✅ Generating {N_LEGIT} legitimate transactions...")
    legit = generate_legitimate_transactions(users, N_LEGIT)
    
    # 3. Inject fraud patterns
    n_per_type = N_FRAUD // 4
    print(f"\n🚨 Injecting {N_FRAUD} fraud transactions ({n_per_type} per type)...")
    
    print(f"   🔓 Account Takeover: {n_per_type}")
    ato = inject_account_takeover(users, n_per_type)
    
    print(f"   💰 Micro-Splitting: {n_per_type}")
    ms = inject_micro_splitting(users, n_per_type)
    
    print(f"   🤝 Merchant Collusion: {n_per_type}")
    mc = inject_merchant_collusion(users, n_per_type)
    
    print(f"   🎭 Social Engineering: {n_per_type}")
    se = inject_social_engineering(users, n_per_type)
    
    # 4. Combine and shuffle
    print("\n🔀 Combining and shuffling...")
    all_txns = legit + ato + ms + mc + se
    df = pd.DataFrame(all_txns)
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    
    # Re-index transaction IDs
    df['transaction_id'] = [f"TXN{str(i).zfill(8)}" for i in range(len(df))]
    
    print(f"   Total transactions: {len(df)}")
    print(f"   Fraud rate: {df['is_fraud'].mean() * 100:.2f}%")
    print(f"   Fraud breakdown:")
    for ftype in ['account_takeover', 'micro_splitting', 'merchant_collusion', 'social_engineering']:
        count = len(df[df['fraud_type'] == ftype])
        print(f"      {ftype}: {count}")
    
    # 5. Add engineered features (sampling for velocity to avoid O(n²) on 50K rows)
    print("\n🔧 Engineering features...")
    
    # Velocity features (sampled approach for speed)
    # For full dataset, we compute approximate velocity using sorted timestamps
    df = df.sort_values(['user_id', 'timestamp']).reset_index(drop=True)
    
    # Fast velocity approximation
    print("   ⚡ Computing velocity features (fast mode)...")
    df['txn_count_1h'] = 0
    df['txn_count_24h'] = 0
    df['minutes_since_last_txn'] = 999.0
    
    prev_user = None
    prev_ts = None
    user_txn_times = {}
    
    for idx in range(len(df)):
        uid = df.at[idx, 'user_id']
        ts = pd.to_datetime(df.at[idx, 'timestamp'])
        
        if uid not in user_txn_times:
            user_txn_times[uid] = []
        
        # Count recent txns
        recent = user_txn_times[uid]
        count_1h = sum(1 for t in recent[-20:] if (ts - t).total_seconds() <= 3600)
        count_24h = sum(1 for t in recent[-50:] if (ts - t).total_seconds() <= 86400)
        
        df.at[idx, 'txn_count_1h'] = count_1h
        df.at[idx, 'txn_count_24h'] = count_24h
        
        if recent:
            diff = (ts - recent[-1]).total_seconds() / 60
            df.at[idx, 'minutes_since_last_txn'] = round(min(diff, 999), 2)
        
        user_txn_times[uid].append(ts)
        
        if idx % 10000 == 0:
            print(f"      Progress: {idx}/{len(df)}")
    
    # Statistical features
    df = add_statistical_features(df)
    
    # 6. Save
    print(f"\n💾 Saving to {OUTPUT_PATH}...")
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)
    
    file_size_mb = os.path.getsize(OUTPUT_PATH) / (1024 * 1024)
    print(f"   File size: {file_size_mb:.1f} MB")
    
    # 7. Summary
    print(f"\n{'=' * 60}")
    print(f"  Dataset Summary")
    print(f"{'=' * 60}")
    print(f"  Rows:           {len(df)}")
    print(f"  Columns:        {len(df.columns)}")
    print(f"  Fraud rate:     {df['is_fraud'].mean() * 100:.2f}%")
    print(f"  Users:          {df['user_id'].nunique()}")
    print(f"  States:         {df['state'].nunique()}")
    print(f"  Banks:          {df['bank'].nunique()}")
    print(f"  Categories:     {df['category'].nunique()}")
    print(f"  Devices:        {df['device'].nunique()}")
    print(f"  Date range:     {df['timestamp'].min()} → {df['timestamp'].max()}")
    print(f"\n  Columns: {list(df.columns)}")
    print(f"\n✅ Done! Dataset saved to: {OUTPUT_PATH}")


if __name__ == '__main__':
    main()
