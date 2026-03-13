import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert "status" in response.json()
    assert response.json()["status"] == "ok"

def test_predict_endpoint_validation():
    # Test missing fields
    response = client.post("/api/v1/predict", json={"amount": 100})
    assert response.status_code == 422  # Unprocessable Entity because missing merchant

def test_analyze_text_scam():
    payload = {"text": "URGENT block your pan card now click here for kyc", "source": "sms"}
    response = client.post("/api/v1/analyze-text", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_scam"] == True
    assert data["risk_score"] > 0.6
    assert len(data["matches"]) > 0

def test_analyze_text_safe():
    payload = {"text": "Hey mom, just checking in. Call me later.", "source": "sms"}
    response = client.post("/api/v1/analyze-text", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_scam"] == False
    assert data["risk_score"] < 0.2
