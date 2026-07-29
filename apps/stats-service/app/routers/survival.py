# apps/stats-service/app/routers/survival.py
# POST /internal/survival — Kaplan-Meier curve + log-rank test (task 3.3).
# Returns the full SurvivalResult (timePoints, survival, CI bands, risk table,
# log-rank p, median) consumed by the TS client's SurvivalCurve component
# (PythonStatsService.computeSurvival). Falls back to a numpy KM when lifelines
# isn't installed so the service stays usable in CI (design degradation).

from __future__ import annotations

from fastapi import APIRouter

from ..schemas import SurvivalRequest, SurvivalCurvePoint, SurvivalResult
from ..services import survival as V

router = APIRouter()


@router.post("/internal/survival")
def survival(req: SurvivalRequest) -> SurvivalResult:
    data = req.data or {}
    time = data.get("time", [])
    event = data.get("event", [])
    group = data.get("group", [])
    try:
        km = V.kaplan_meier(time, event)
        lrp = V.logrank(time, event, group) if group else None
        warnings = list(km.get("warnings", []))
        if km.get("method") == "numpy":
            warnings.append("lifelines_unavailable: numpy KM fallback")
        return SurvivalResult(
            timePoints=km["timePoints"],
            survival=km["survival"],
            ciLower=km["ciLower"],
            ciUpper=km["ciUpper"],
            riskTable=[SurvivalCurvePoint(**p) for p in km["riskTable"]],
            logRankP=lrp,
            medianSurvival=km.get("medianSurvival"),
            warnings=warnings,
        )
    except Exception as exc:
        return SurvivalResult(
            timePoints=[], survival=[], ciLower=[], ciUpper=[], riskTable=[],
            logRankP=None, medianSurvival=None, warnings=[f"survival_error: {exc}"],
        )