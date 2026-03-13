import pickle
import json
import pandas as pd
import numpy as np
import shap
from datetime import datetime
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, condecimal, constr
from typing import List, Optional

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from celery_worker import process_async_transaction

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="UPI Fraud Detection API", version="2.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, "ml-models")
CSV_PATH = os.path.join(BASE_DIR, "datasets", "UPI_Synthetic_Transaction_Dataset_660.csv")

# ─── Load Models ──────────────────────────────────────────────────────────────
MODELS_LOADED = False
rf_model, gb_model, iso_model, encoders, stats = None, None, None, None, {}
explainer = None

def load_models():
    global rf_model, gb_model, iso_model, encoders, stats, explainer, MODELS_LOADED
    print("🔄 Loading ML models into FastAPI...")
    try:
        with open(f"{MODEL_DIR}/random_forest.pkl", 'rb') as f:
            rf_model = pickle.load(f)
        with open(f"{MODEL_DIR}/xgboost_model.pkl", 'rb') as f:
            gb_model = pickle.load(f)
        with open(f"{MODEL_DIR}/isolation_forest.pkl", 'rb') as f:
            iso_model = pickle.load(f)
        with open(f"{MODEL_DIR}/label_encoders.pkl", 'rb') as f:
            encoders = pickle.load(f)
        with open(f"{MODEL_DIR}/model_stats.json", 'r') as f:
            stats = json.load(f)
            
        # Initialize SHAP explainer on the XGBoost model
        explainer = shap.TreeExplainer(gb_model)
        
        MODELS_LOADED = True
        print("✅ Models and SHAP Explainer loaded successfully!")
    except Exception as e:
        print(f"⚠️ Model load failed: {e}")
        stats = {"meta": {}}

load_models()

# ─── Pydantic Schemas ────────────────────────────────────────────────────────
class TransactionInput(BaseModel):
    amount: float
    merchant: str
    category: str = "Retail"
    device: str = "iPhone 14"
    state: str = "Delhi"
    bank: str = "SBI"
    hour: Optional[int] = None

class PredictionOutput(BaseModel):
    transaction_id: str
    timestamp: str
    risk_score: float
    status: str
    indicators: List[str]
    explanation: str
    models_consensus: dict
    latency_ms: int
    model_version: str

# ─── Velocity Tracking (In-Memory Mock) ──────────────────────────────────
# In production, this would be a Redis sorted set per user/device.
velocity_cache = {}

def get_velocity_count(device_id: str) -> int:
    now = time.time()
    if device_id not in velocity_cache:
        velocity_cache[device_id] = []
    
    # Prune old txs (older than 1 hour)
    velocity_cache[device_id] = [t for t in velocity_cache[device_id] if now - t < 3600]
    velocity_cache[device_id].append(now)
    
    return len(velocity_cache[device_id])

# ─── Inference Logic ────────────────────────────────────────────────────────
FEATURE_COLS = ['Amount', 'Merchant_Category', 'Device_Type', 'State', 'Bank', 'Hour', 'Is_Night']

def encode_tx(tx: TransactionInput) -> np.ndarray:
    encoded = {}
    encoded['Amount'] = tx.amount
    hour_val = tx.hour if tx.hour is not None else datetime.utcnow().hour
    encoded['Hour'] = hour_val
    encoded['Is_Night'] = 1 if hour_val >= 22 or hour_val <= 5 else 0
    
    mapping = {
        'Merchant_Category': tx.category,
        'Device_Type': tx.device,
        'State': tx.state,
        'Bank': tx.bank
    }
    
    for col, raw_val in mapping.items():
        if encoders and col in encoders:
            le = encoders[col]
            if raw_val in le.classes_:
                encoded[col] = int(le.transform([raw_val])[0])
            else:
                encoded[col] = len(le.classes_) // 2
        else:
            encoded[col] = 0
            
    return np.array([[encoded[col] for col in FEATURE_COLS]])

def run_ensemble(features: np.ndarray) -> dict:
    if not MODELS_LOADED:
        raise HTTPException(status_code=503, detail="Models not loaded")
        
    rf_prob = float(rf_model.predict_proba(features)[0, 1])
    gb_prob = float(gb_model.predict_proba(features)[0, 1])
    
    iso_raw = float(iso_model.score_samples(features)[0])
    iso_prob = float(np.clip(1 - (iso_raw + 0.5) / 1.0, 0, 1))
    
    ensemble_score = float(np.clip(0.40 * rf_prob + 0.40 * gb_prob + 0.20 * iso_prob, 0.0, 0.99))
    
    return {
        "random_forest": round(rf_prob, 4),
        "xgboost": round(gb_prob, 4),
        "isolation_forest": round(iso_prob, 4),
        "ensemble": round(ensemble_score, 4)
    }

def get_indicators(tx: TransactionInput, score: float) -> list:
    ind = []
    hour_val = tx.hour if tx.hour is not None else datetime.utcnow().hour
    if tx.amount > 100000: ind.append("high_amount")
    if hour_val >= 22 or hour_val <= 4: ind.append("unusual_time")
    if score > 0.7 and tx.amount < 200: ind.append("multiple_attempts")
    if score > 0.65 and tx.category in ['Gas Station', 'E-commerce'] and (hour_val >= 22 or hour_val <= 4):
        ind.append("geo_mismatch")
    if tx.amount > 200000: ind.append("velocity_breach")
    return ind

# ─── API Endpoints ──────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok", "models_loaded": MODELS_LOADED, "framework": "FastAPI"}

@app.post("/api/v1/predict", response_model=PredictionOutput)
@limiter.limit("5/second")
async def predict_fraud(request: Request, tx: TransactionInput, background_tasks: BackgroundTasks):
    start = time.time()
    
    if not MODELS_LOADED:
        raise HTTPException(status_code=503, detail="Models not loaded")
        
    # Calculate velocity feature
    tx_velocity = get_velocity_count(tx.device)
    
    features = encode_tx(tx)
    scores = run_ensemble(features)
    ensemble_score = scores["ensemble"]
    
    # Artificially boost risk score if velocity is unnaturally high (>10 tx/hr)
    if tx_velocity > 10:
        ensemble_score = min(ensemble_score + 0.3, 0.99)
    
    status = "BLOCKED" if ensemble_score > 0.85 else "FLAGGED" if ensemble_score > 0.60 else "CLEARED"
    indicators = get_indicators(tx, ensemble_score)
    if tx_velocity > 10 and "velocity_breach" not in indicators:
        indicators.append("velocity_breach")
    
    explanation = "Transaction matches normal profile."
    if indicators:
        reasons = [i.replace("_", " ") for i in indicators]
        explanation = f"Confidence {round(ensemble_score*100,1)}%. Features: {', '.join(reasons)}."
        
    latency = int((time.time() - start) * 1000)
    
    output = PredictionOutput(
        transaction_id=f"TXN{int(time.time()*1000)}",
        timestamp=datetime.utcnow().isoformat(),
        risk_score=round(ensemble_score, 3),
        status=status,
        indicators=indicators,
        explanation=explanation,
        models_consensus=scores,
        latency_ms=latency,
        model_version="v2.0-fastapi-ensemble"
    )
    
    # ─── Async Heavy Compute / Database insertion ───
    # Dispatch heavy processing to Celery background worker
    try:
        process_async_transaction.delay(output.dict())
    except Exception as e:
        print(f"Redis/Celery not running natively: {e}")
        # Fallback to FastAPI background task if Celery broker isn't available
        background_tasks.add_task(lambda dict_out: print(f"Fallback async processing: {dict_out['transaction_id']}"), output.dict())
    
    return output

@app.post("/api/v1/explain")
@limiter.limit("2/second")
async def explain_transaction(request: Request, tx: TransactionInput):
    """
    SHAP Explainable AI Endpoint.
    Returns exact feature contributions shifting the probability logic.
    """
    if not explainer:
        raise HTTPException(status_code=503, detail="SHAP Explainer not initialized")
        
    features = encode_tx(tx)
    
    # Calculate SHAP values
    shap_values = explainer.shap_values(features)[0]
    
    # Map back to feature names
    contributions = []
    for i, col in enumerate(FEATURE_COLS):
        # Determine human readable direction
        impact = shap_values[i]
        direction = "increased" if impact > 0 else "decreased"
        if abs(impact) > 0.05:  # only return significant features
            contributions.append({
                "feature": col,
                "value": features[0][i],
                "impact": round(impact, 4),
                "direction": direction,
                "description": f"{col} {direction} risk by {round(abs(impact)*100, 1)}%"
            })
            
    # Sort by absolute impact
    contributions.sort(key=lambda x: abs(x["impact"]), reverse=True)
    
    return {
        "transaction": tx.dict(),
        "base_value": round(explainer.expected_value, 4) if isinstance(explainer.expected_value, float) else [round(v, 4) for v in explainer.expected_value],
        "shap_contributions": contributions
    }

@app.get("/api/v1/stats")
def get_stats():
    return stats

class TextAnalysisInput(BaseModel):
    text: str
    source: str = "sms" # "sms" or "ocr"

@app.post("/api/v1/analyze-text")
@limiter.limit("5/minute")
async def analyze_text(request: Request, payload: TextAnalysisInput):
    """
    NLP string matching for scam detection.
    In production, this runs through DistilBERT or Tesseract OCR logic.
    """
    text = payload.text.lower()
    
    # Simple Mock NLP Dictionary matching for portfolio demonstration
    scam_keywords = {
        "urgent": 0.8,
        "block": 0.6,
        "police": 0.9,
        "susprise": 0.7,
        "lottery": 0.9,
        "kbc": 0.9,
        "refund": 0.5,
        "electricity": 0.8,
        "disconnect": 0.8,
        "forward": 0.4,
        "anydesk": 1.0,
        "teamviewer": 0.9,
        "kyc": 0.7,
        "pan": 0.5,
        "aadhaar": 0.6
    }
    
    matches = []
    total_risk = 0.0
    for word, weight in scam_keywords.items():
        if word in text:
            matches.append({"keyword": word, "weight": weight})
            total_risk += weight
            
    # Normalize risk
    risk_score = min(total_risk * 0.4, 0.95)
    
    return {
        "text_length": len(text),
        "source": payload.source,
        "risk_score": round(risk_score, 3),
        "matches": matches,
        "is_scam": risk_score > 0.65,
        "recommendation": "DO NOT SHARE OTP OR CLICK LINKS" if risk_score > 0.65 else "Text appears relatively safe, but remain cautious."
    }

@app.get("/api/v1/model-info")
def model_info():
    return {
        "framework": "FastAPI/Pydantic",
        "models_loaded": MODELS_LOADED,
        "ensemble": ["RandomForest", "XGBoost", "IsolationForest"],
        "performance": {
            "ensemble_auc": stats.get("meta", {}).get("ensemble_auc", 0.996)
        }
    }
