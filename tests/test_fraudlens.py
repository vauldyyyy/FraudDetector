"""Tests for the v3 pipeline: point-in-time features, training, and the scoring API."""
import random
from datetime import datetime, timedelta

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from fraudlens.features import FEATURES, FeatureStore
from fraudlens.model import Bundle, encode
from fraudlens.service import create_app
from fraudlens.train import train

T0 = datetime(2025, 1, 1)


def tx(ts, amount=500.0, user="u1", device="Pixel", state="Goa", category="Retail", **kw):
    return dict(transaction_id=kw.pop("tid", f"{user}-{ts}"), user_id=user, amount=amount,
                category=category, device=device, state=state, bank="SBI", timestamp=ts,
                account_age_days=kw.pop("age", 400), **kw)


def synthetic_log(n_users=150, days=60, seed=7) -> pd.DataFrame:
    """Small log with two learnable fraud patterns (account takeover, micro-splitting)."""
    rng = random.Random(seed)
    rows, k = [], 0
    for u in range(n_users):
        base = rng.uniform(200, 3000)
        for _ in range(rng.randint(10, 30)):
            ts = T0 + timedelta(days=rng.uniform(0, days), hours=rng.uniform(8, 21))
            rows.append(tx(ts.isoformat(), round(rng.gauss(base, base / 4) + 1, 2), user=f"u{u}",
                           tid=f"t{k}", is_fraud=0, fraud_type="none"))
            k += 1
        if rng.random() < 0.3:  # account takeover: new device, night, large amount
            ts = T0 + timedelta(days=rng.uniform(5, days), hours=rng.choice([1, 2, 3]))
            rows.append(tx(ts.isoformat(), round(base * rng.uniform(8, 15), 2), user=f"u{u}",
                           device="Unknown-Android", tid=f"t{k}", is_fraud=1, fraud_type="account_takeover"))
            k += 1
        if rng.random() < 0.2:  # micro-splitting burst
            start = T0 + timedelta(days=rng.uniform(5, days), hours=14)
            for j in range(6):
                rows.append(tx((start + timedelta(minutes=2 * j)).isoformat(), round(rng.uniform(90, 199), 2),
                               user=f"u{u}", tid=f"t{k}", is_fraud=1, fraud_type="micro_splitting"))
                k += 1
    return pd.DataFrame(rows)


# --------------------------------------------------------------------------- features
def test_features_ignore_the_future():
    log = [tx("2025-01-01T10:00:00", 100), tx("2025-01-01T10:20:00", 200),
           tx("2025-01-01T10:40:00", 50_000, device="New")]
    full = FeatureStore().replay(log)
    prefix = FeatureStore().replay(log[:2])
    assert full[:2] == prefix  # adding a later transaction cannot change earlier features


def test_velocity_windows_and_novelty():
    fs = FeatureStore()
    fs.replay([tx("2025-01-01T08:00:00"), tx("2025-01-01T09:30:00"), tx("2025-01-01T09:50:00")])
    f = fs.compute(tx("2025-01-01T10:00:00", device="Other", state="Delhi"))
    assert f["txn_count_1h"] == 2 and f["txn_count_24h"] == 3
    assert f["minutes_since_last_txn"] == pytest.approx(10.0)
    assert f["is_new_device"] == 1 and f["is_new_state"] == 1
    f = fs.compute(tx("2025-01-02T09:00:00"))
    assert f["txn_count_24h"] == 2  # the 08:00 transaction has left the 24h window


def test_first_transaction_is_not_flagged_as_new_device():
    f = FeatureStore().compute(tx("2025-01-01T10:00:00"))
    assert f["is_new_device"] == 0 and f["user_txn_count"] == 0 and f["amount_zscore"] == 0.0


def test_unknown_category_encodes_to_minus_one():
    f = FeatureStore().compute(tx("2025-01-01T10:00:00", category="Never-seen"))
    vocab = {"category": ["Retail"], "device": ["Pixel"], "state": ["Goa"], "bank": ["SBI"]}
    X = encode([f], vocab)
    assert X[0, FEATURES.index("category")] == -1


# --------------------------------------------------------------------------- training
@pytest.fixture(scope="module")
def bundle_dir(tmp_path_factory):
    d = tmp_path_factory.mktemp("fl")
    csv = d / "log.csv"
    synthetic_log().to_csv(csv, index=False)
    meta = train(str(csv), str(d / "bundle"), str(d / "report.md"))
    assert (d / "report.md").exists()
    return str(d / "bundle"), meta


def test_training_learns_and_thresholds_are_ordered(bundle_dir):
    _, meta = bundle_dir
    assert meta["metrics"]["test"]["roc_auc"] > 0.9
    t = meta["thresholds"]
    assert 0 < t["flag"] <= t["block"] < 1


def test_train_serve_parity(bundle_dir):
    """Online scoring reproduces offline features for the same event sequence."""
    path, _ = bundle_dir
    b = Bundle.load(path)
    log = synthetic_log(n_users=5, days=10, seed=3).sort_values("timestamp")
    records = log.drop(columns=["is_fraud", "fraud_type"]).to_dict("records")
    offline = FeatureStore(b.meta["amount_quantiles"]).replay(records)
    # Offline replay vs the online scorer used by the API, event by event.
    from fraudlens.model import Scorer
    scorer = Scorer(b)
    online = [scorer.score(r)["features"] for r in records]
    assert online == offline
    # And through HTTP: the API's store ends in the same state.
    client = TestClient(create_app(path))
    for r in records:
        client.post("/v1/score", json=r).raise_for_status()
    api_store = client.app.state.scorer.store
    for u, st in scorer.store.users.items():
        assert api_store.users[u].n == st.n and api_store.users[u].mean == pytest.approx(st.mean)


# --------------------------------------------------------------------------- API
@pytest.fixture()
def client(bundle_dir):
    return TestClient(create_app(bundle_dir[0]))


def test_score_endpoint(client):
    r = client.post("/v1/score", json=tx("2025-03-01T12:00:00", 750, tid="a1"))
    assert r.status_code == 200
    body = r.json()
    assert 0 <= body["risk_score"] <= 1
    assert body["decision"] in {"CLEARED", "FLAGGED", "BLOCKED"}
    assert len(body["top_factors"]) == 5 and body["model_version"].startswith("v3-")


def test_idempotent_replay_does_not_double_count(client):
    first = client.post("/v1/score", json=tx("2025-03-01T12:00:00", tid="dup")).json()
    again = client.post("/v1/score", json=tx("2025-03-01T12:00:00", tid="dup")).json()
    assert again["replayed"] and again["risk_score"] == first["risk_score"]
    assert client.app.state.scorer.store.users["u1"].n == 1


def test_takeover_scores_higher_than_routine_payment(client):
    for i in range(12):
        client.post("/v1/score", json=tx(f"2025-02-{1 + i:02d}T12:00:00", 800, user="v", tid=f"v{i}"))
    routine = client.post("/v1/score", json=tx("2025-02-20T12:00:00", 820, user="v", tid="v-ok")).json()
    attack = client.post("/v1/score", json=tx("2025-02-20T02:00:00", 11_000, user="v",
                                                device="Unknown-Android", tid="v-ato")).json()
    assert attack["risk_score"] > routine["risk_score"]


@pytest.mark.parametrize("bad", [{"amount": -5}, {"amount": 0}, {"user_id": ""},
                                 {"account_age_days": -1}])
def test_rejects_invalid_input(client, bad):
    assert client.post("/v1/score", json=tx("2025-03-01T12:00:00", tid="x") | bad).status_code == 422


def test_metrics_and_model_endpoints(client):
    client.post("/v1/score", json=tx("2025-03-01T12:00:00", tid="m1"))
    m = client.get("/metrics").json()
    assert m["requests"] >= 1 and m["latency_ms"]["p50"] is not None
    info = client.get("/v1/model").json()
    assert info["features"] == FEATURES and "thresholds" in info
