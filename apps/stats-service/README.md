# Stats Service — MediCore Research Engine V2

Stateless Python (FastAPI + SciPy/statsmodels/lifelines) microservice that
performs inferential statistics for the Research Engine V2 (spec §1, BR-RES-005,
design AD-1). The NestJS API calls it over HTTP via `PythonStatsService`,
wrapped in BullMQ + a circuit breaker with graceful degradation.

## Endpoints (internal)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness/readiness probe |
| POST | `/internal/stats/inferential` | t-test, Mann-Whitney, Kruskal-Wallis, ANOVA, chi-square, Fisher, Pearson/Spearman, linear/logistic regression, KM headline |
| POST | `/internal/stats/regression` | Direct regression entrypoint |
| POST | `/internal/survival` | Kaplan-Meier curve + log-rank (full arrays/CI/risk-table) |
| POST | `/internal/cross-tab` | Contingency table with N<5 suppression (BR-RES-004) |

## Contracts

Pydantic schemas in `app/schemas.py` mirror `@medicore/contracts` Zod schemas
(`StatisticalTestResult`, `SurvivalResult`, `CrossTabResult`, `InferentialRequest`).
Keep them in lock-step (a `zod_to_pydantic` codegen is tracked as an open design
question).

## Run locally

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8100
```

## Test

```bash
pytest
```

SciPy is a hard dependency — tests skip if absent. `lifelines` is optional; a
numpy Kaplan-Meier + log-rank fallback keeps the service answering in CI.

## Deploy

Container (Fly.io), autoscale min=1 warm to absorb cold-start latency. Stateless
— any instance can serve any request.