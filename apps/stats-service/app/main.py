# apps/stats-service/app/main.py
# FastAPI application — the stateless Python stats microservice (spec §1,
# BR-RES-005, design AD-1). Mirrors @medicore/contracts Zod schemas through
# Pydantic (app/schemas.py). Endpoints are internal (_not_ exposed to end users):
#   GET  /health                       Liveness/readiness probe
#   POST /internal/stats/inferential   All inferential tests (task 3.2)
#   POST /internal/stats/regression    Linear / logistic regression (task 3.3)
#   POST /internal/survival            Kaplan-Meier + log-rank (task 3.3)
#   POST /internal/cross-tab           Contingency table (contract parity)
#
# Deploy: container (Fly.io), autoscale min=1 warm so cold-start latency is
# absorbed; the API wraps every call in BullMQ + a circuit breaker regardless.

from __future__ import annotations

from fastapi import FastAPI

from .routers import inferential, regression, survival, crosstab
from .routers import normality

app = FastAPI(
    title="MediCore Stats Service",
    version="3.0.0",
    description="Stateless inferential-stats microservice for the Research Engine (V2 + V3).",
)


@app.get("/health")
def health():
    """Liveness/readiness probe (returned to PythonStatsService.health())."""
    return {"status": "ok", "service": "medicore-stats-service", "version": "3.0.0"}


app.include_router(inferential.router)
app.include_router(regression.router)
app.include_router(survival.router)
app.include_router(crosstab.router)
app.include_router(normality.router)