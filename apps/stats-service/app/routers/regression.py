# apps/stats-service/app/routers/regression.py
# POST /internal/stats/regression — direct regression entrypoint (task 3.3).
# Also used by the inferential dispatcher for linear/logistic tests so the TS
# client can call either /internal/stats/inferential or this dedicated route.

from __future__ import annotations

from fastapi import APIRouter

from ..schemas import InferentialRequest, StatisticalTestResult
from ..services import regression as R
from .inferential import _as_result, _err

router = APIRouter()


@router.post("/internal/stats/regression")
def regression(req: InferentialRequest) -> StatisticalTestResult:
    data = req.data or {}
    alpha = req.alpha
    try:
        if req.test == "linear_regression":
            return _as_result(R.linear_regression(data.get("x", []), data.get("y", []), alpha))
        if req.test == "logistic_regression":
            return _as_result(R.logistic_regression(data.get("x", []), data.get("y", []), alpha))
        return _err(req.test, f"regression router handles linear/logistic only; got {req.test}")
    except Exception as exc:
        return _err(req.test, str(exc))