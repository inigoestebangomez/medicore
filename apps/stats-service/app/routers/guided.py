# apps/stats-service/app/routers/guided.py
# POST /internal/stats/relative-risk — RR/OR from 2x2 table (no continuity correction)
# POST /internal/stats/p-adjust — Holm / BH-FDR p-value adjustment
# These endpoints serve the guided statistical analysis workflow (V5).

from __future__ import annotations

from fastapi import APIRouter

from ..schemas import (
    RelativeRiskRequest,
    RelativeRiskResult,
    PAdjustRequest,
    PAdjustResult,
    AssumptionWarning,
)
from ..services import stats as S

router = APIRouter()


@router.post("/internal/stats/relative-risk", response_model=RelativeRiskResult)
def compute_relative_risk(req: RelativeRiskRequest) -> RelativeRiskResult:
    """Compute RR and OR from a 2x2 table. Suppresses on zero cells."""
    raw = S.relative_risk(
        exposed_cases=req.exposedCases,
        exposed_non_cases=req.exposedNonCases,
        unexposed_cases=req.unexposedCases,
        unexposed_non_cases=req.unexposedNonCases,
        alpha=req.alpha,
    )
    # Convert raw warnings dicts to AssumptionWarning models
    warnings = [
        w if isinstance(w, AssumptionWarning) else AssumptionWarning(**w)
        for w in raw.get("warnings", [])
    ]
    return RelativeRiskResult(
        relativeRisk=raw.get("relativeRisk"),
        ci95Lower=raw.get("ci95Lower"),
        ci95Upper=raw.get("ci95Upper"),
        oddsRatio=raw.get("oddsRatio"),
        orCi95Lower=raw.get("orCi95Lower"),
        orCi95Upper=raw.get("orCi95Upper"),
        exposedCases=raw["exposedCases"],
        exposedNonCases=raw["exposedNonCases"],
        unexposedCases=raw["unexposedCases"],
        unexposedNonCases=raw["unexposedNonCases"],
        suppressed=raw.get("suppressed", False),
        suppressReason=raw.get("suppressReason"),
        warnings=warnings,
    )


@router.post("/internal/stats/p-adjust", response_model=PAdjustResult)
def adjust_p_values(req: PAdjustRequest) -> PAdjustResult:
    """Adjust p-values for multiple comparisons (Holm or BH-FDR)."""
    raw = S.p_adjust(p_values=req.pValues, method=req.method)
    return PAdjustResult(
        method=raw["method"],
        originalP=raw["originalP"],
        adjustedP=raw["adjustedP"],
        n=raw["n"],
    )
