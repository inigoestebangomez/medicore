# apps/stats-service/Dockerfile
# Stateless Python stats microservice (design AD-1). Fly.io autoscale warm min=1.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install deps first for layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8100
# Fly.io expects the process to bind 0.0.0.0. The service is stateless; any
# instance can serve any request (autoscale friendly).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100"]