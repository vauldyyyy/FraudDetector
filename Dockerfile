FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements-service.txt .
RUN pip install --no-cache-dir -r requirements-service.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run with uvicorn
# v3 service: point-in-time features + XGBoost bundle in ml-models/fraudlens_v3
# Note: per-user feature state is in-process; run one worker per instance, or back
# FeatureStore with Redis before scaling horizontally.
CMD ["uvicorn", "fraudlens.service:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
