"""Point-in-time feature computation, shared by training and serving.

Every feature for a transaction is computed only from that user's *earlier*
transactions. Training replays the historical log in timestamp order through the
same `FeatureStore` the API uses live, so offline and online features cannot drift
apart (no training/serving skew) and nothing from the future leaks into training.

The earlier pipeline (scripts/generate_dataset.py) computes per-user amount
statistics over each user's *full* history, including later and fraudulent
transactions, and ranks amounts against the whole dataset. Those values cannot
exist at the moment a payment is scored, so a model trained on them cannot be
served faithfully. This module computes the same signals point-in-time.
"""
from __future__ import annotations

import bisect
import math
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Iterable

CATEGORICAL = ["category", "device", "state", "bank"]
NUMERIC = [
    "amount", "log_amount", "hour", "day_of_week", "is_night", "is_weekend",
    "account_age_days", "is_new_device", "is_new_state", "is_new_category",
    "txn_count_1h", "txn_count_24h", "amount_sum_24h", "minutes_since_last_txn",
    "user_txn_count", "amount_zscore", "amount_vs_median", "amount_percentile",
    "is_round_amount",
]
FEATURES = CATEGORICAL + NUMERIC

HOUR, DAY = 3600.0, 86400.0
RECENT_AMOUNTS = 50          # amounts kept per user for a rolling median
NO_HISTORY_MINUTES = 10_000  # "minutes since last" when the user has no history


@dataclass
class UserState:
    window: deque = field(default_factory=deque)        # (epoch_s, amount) within 24h
    last_ts: float | None = None
    n: int = 0                                          # Welford running stats
    mean: float = 0.0
    m2: float = 0.0
    recent: deque = field(default_factory=lambda: deque(maxlen=RECENT_AMOUNTS))
    devices: set = field(default_factory=set)
    states: set = field(default_factory=set)
    categories: set = field(default_factory=set)


def _naive_utc_epoch(dt: datetime) -> float:
    return (dt - datetime(1970, 1, 1)).total_seconds()


class FeatureStore:
    """In-memory per-user state. The interface is small enough to back with Redis."""

    def __init__(self, amount_quantiles: list[float] | None = None):
        self.users: dict[str, UserState] = {}
        # Frozen amount distribution from the training window, for a leak-free percentile.
        self.quantiles = sorted(amount_quantiles or [])

    # ------------------------------------------------------------------ features
    def compute(self, tx: dict) -> dict:
        """Features for `tx` using only state from earlier transactions. Does not mutate."""
        ts = _epoch(tx["timestamp"])
        dt = _dt(ts)
        amount = float(tx["amount"])
        st = self.users.get(tx["user_id"])

        in_1h = in_24h = 0
        sum_24h = 0.0
        if st:
            for t, a in st.window:
                if ts - DAY <= t < ts:
                    in_24h += 1
                    sum_24h += a
                    if t >= ts - HOUR:
                        in_1h += 1

        has_hist = bool(st and st.n)
        std = math.sqrt(st.m2 / (st.n - 1)) if has_hist and st.n > 1 else 0.0
        median = _median(st.recent) if has_hist else 0.0
        f = {
            "category": str(tx["category"]),
            "device": str(tx["device"]),
            "state": str(tx["state"]),
            "bank": str(tx["bank"]),
            "amount": amount,
            "log_amount": math.log1p(max(amount, 0.0)),
            "hour": dt.hour,
            "day_of_week": dt.weekday(),
            "is_night": int(dt.hour >= 22 or dt.hour <= 5),
            "is_weekend": int(dt.weekday() >= 5),
            "account_age_days": float(tx.get("account_age_days") or 0),
            "is_new_device": int(has_hist and tx["device"] not in st.devices),
            "is_new_state": int(has_hist and tx["state"] not in st.states),
            "is_new_category": int(has_hist and tx["category"] not in st.categories),
            "txn_count_1h": in_1h,
            "txn_count_24h": in_24h,
            "amount_sum_24h": round(sum_24h, 2),
            "minutes_since_last_txn": (min((ts - st.last_ts) / 60.0, NO_HISTORY_MINUTES)
                                       if has_hist and st.last_ts is not None else NO_HISTORY_MINUTES),
            "user_txn_count": st.n if st else 0,
            "amount_zscore": max(-5.0, min(5.0, (amount - st.mean) / max(std, 1.0))) if has_hist else 0.0,
            "amount_vs_median": amount / max(median, 1.0) if has_hist else 1.0,
            "amount_percentile": (bisect.bisect_right(self.quantiles, amount) / len(self.quantiles)
                                  if self.quantiles else 0.5),
            "is_round_amount": int(amount >= 5000 and amount % 1000 == 0),
        }
        return f

    def update(self, tx: dict) -> None:
        """Record `tx` so later transactions see it."""
        ts = _epoch(tx["timestamp"])
        amount = float(tx["amount"])
        st = self.users.setdefault(tx["user_id"], UserState())
        st.window.append((ts, amount))
        while st.window and st.window[0][0] < ts - DAY:
            st.window.popleft()
        st.last_ts = ts if st.last_ts is None else max(st.last_ts, ts)
        st.n += 1
        delta = amount - st.mean
        st.mean += delta / st.n
        st.m2 += delta * (amount - st.mean)
        st.recent.append(amount)
        st.devices.add(tx["device"])
        st.states.add(tx["state"])
        st.categories.add(tx["category"])

    def replay(self, txs: Iterable[dict]) -> list[dict]:
        """Features for each transaction in time order, then update. Used for training."""
        out = []
        for tx in txs:
            out.append(self.compute(tx))
            self.update(tx)
        return out


def _epoch(ts) -> float:
    if isinstance(ts, (int, float)):
        return float(ts)
    if isinstance(ts, datetime):
        if ts.tzinfo is not None:
            return ts.timestamp()
        return _naive_utc_epoch(ts)
    s = str(ts).replace("Z", "+00:00")
    return _epoch(datetime.fromisoformat(s))


def _dt(epoch: float) -> datetime:
    """Naive UTC datetime (timestamps without a zone are treated as UTC)."""
    return datetime(1970, 1, 1) + timedelta(seconds=epoch)


def _median(values) -> float:
    s = sorted(values)
    n = len(s)
    return 0.0 if n == 0 else (s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2)


def amount_quantiles(amounts, n: int = 1000) -> list[float]:
    s = sorted(float(a) for a in amounts)
    if not s:
        return []
    return [s[min(len(s) - 1, int(i * len(s) / n))] for i in range(n)]
