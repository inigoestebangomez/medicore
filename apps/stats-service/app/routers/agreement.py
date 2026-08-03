# apps/stats-service/app/routers/agreement.py
# Agreement / reliability endpoints for the Research V4 form builder
# (REQ-FB-010). Three POST routes consumed by PythonStatsService.runKappa /
# runIcc / runCronbach (apps/api/src/infrastructure/stats/python-stats.service.ts).
#
# The TS client posts the rater/subject arrays at the top level (no `test`
# field, no `data` wrapper) and reads an AgreementResult
# ({ statistic, pValue, n, warnings }). These dedicated Pydantic schemas
# mirror that contract exactly — they intentionally do NOT reuse
# InferentialRequest/StatisticalTestResult (those are scoped to the
# InferentialTest enum and a wider result shape).

from __future__ import annotations

from typing import Any, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from ..services import agreement as A

router = APIRouter()


# ─────────────────────────────────────────────
# Request / Response schemas (mirror TS AgreementResult)
# ─────────────────────────────────────────────


class _AgreementBase(BaseModel):
    alpha: float = 0.05


class KappaRequest(_AgreementBase):
    raterA: List[Any]
    raterB: List[Any]


class IccRequest(_AgreementBase):
    valuesByRater: List[List[float]]


class CronbachRequest(_AgreementBase):
    itemsBySubject: List[List[float]]


class AgreementResult(BaseModel):
    statistic: Optional[float] = None
    pValue: Optional[float] = None
    n: int = 0
    warnings: List[str] = []


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────


@router.post("/internal/stats/kappa", response_model=AgreementResult)
def kappa(req: KappaRequest) -> AgreementResult:
    try:
        raw = A.kappa_cohen(req.raterA, req.raterB, req.alpha)
        return AgreementResult(**raw)
    except Exception as exc:  # graceful — never 5xx (BR-RES-005)
        return AgreementResult(statistic=None, pValue=None, n=len(req.raterA), warnings=[f"kappa_fit_error: {exc}"])


@router.post("/internal/stats/icc", response_model=AgreementResult)
def icc(req: IccRequest) -> AgreementResult:
    try:
        raw = A.icc_two_way(req.valuesByRater, req.alpha)
        return AgreementResult(**raw)
    except Exception as exc:
        n = len(req.valuesByRater[0]) if req.valuesByRater else 0
        return AgreementResult(statistic=None, pValue=None, n=n, warnings=[f"icc_fit_error: {exc}"])


@router.post("/internal/stats/cronbach", response_model=AgreementResult)
def cronbach(req: CronbachRequest) -> AgreementResult:
    try:
        raw = A.cronbach_alpha(req.itemsBySubject, req.alpha)
        return AgreementResult(**raw)
    except Exception as exc:
        n = len(req.itemsBySubject)
        return AgreementResult(statistic=None, pValue=None, n=n, warnings=[f"cronbach_fit_error: {exc}"])