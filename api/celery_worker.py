from celery import Celery
import time
import os

# For a production build this would point to a real Redis cluster DSN.
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "fraud_tasks",
    broker=redis_url,
    backend=redis_url
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

@celery_app.task(name="process_async_transaction")
def process_async_transaction(tx_data: dict) -> dict:
    """
    Mock Celery Task:
    In a real production environment, the heavy XGBoost ONNX inference 
    happens here on a separate worker node, freeing up the FastAPI HTTP threads.
    """
    # 1. Simulate heavy model inference latency
    time.sleep(0.05) 
    
    # 2. Simulate saving to PostgreSQL/Supabase directly from the worker
    # supabase.table("transactions").insert(tx_data).execute()
    
    return {"status": "success", "tx_id": tx_data.get("transaction_id", "unknown")}
