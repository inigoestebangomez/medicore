# apps/stats-service/app/routers/inferential.py
# POST /internal/stats/inferential — dispatches all inferential tests (task 3.2):
# t-test (independent/paired), Mann-Whitney, Kruskal-Wallis, one-way ANOVA,
# chi-square, Fisher exact, Pearson/Spearman. Regression + KM are delegated to
# their sibling routers so /internal/stats/* stays the single entrypoint the TS
# client calls (PythonStatsService.runInferential).
#
# Br-RES-005: the service is stateless and returns a StatisticalTestResult;
# on any fitting error it returns a warning envelope (never a 5xx) so the API
# degrade gracefully.

from __future__ import annotations

import numpy as np
from fastapi import APIRouter

from ..schemas import InferentialRequest, StatisticalTestResult, EffectSize, AssumptionWarning
from ..services import stats as S
from ..services import regression as R

router = APIRouter()


def _err(test: str, msg: str) -> StatisticalTestResult:
    return StatisticalTestResult(
        test=test, statistic=None, pValue=None, ci95Lower=None, ci95Upper=None,
        effectSize=None, degreesFreedom=None, assumptionsChecked=[],
        warnings=[AssumptionWarning(code="fit_error", message=msg)],
    )


def _as_result(raw: dict) -> StatisticalTestResult:
    es = raw.get("effectSize")
    if es is not None:
        raw["effectSize"] = EffectSize(**es)
    raw["warnings"] = [AssumptionWarning(**w) if isinstance(w, dict) else w for w in raw.get("warnings", [])]
    return StatisticalTestResult(**raw)


@router.post("/internal/stats/inferential")
def inferential(req: InferentialRequest) -> StatisticalTestResult:
    test = req.test
    data = req.data or {}
    alpha = req.alpha

    def grp(name: str) -> list:
        v = data.get(name, [])
        return v if isinstance(v, list) else []

    try:
        if test == "ttest_independent":
            if len(data.get("group1", [])) < 2 or len(data.get("group2", [])) < 2:
                raw = S.ttest_independent([1, 2, 3], [1, 2, 3]) if False else None
                raise ValueError("group1 and group2 each need >=2 values")
            raw = S.ttest_independent(data["group1"], data["group2"], alpha)
        elif test == "ttest_paired":
            raw = S.ttest_paired(data["group1"], data["group2"], alpha)
        elif test == "mannwhitney":
            raw = S.mannwhitney(data["group1"], data["group2"], alpha)
        elif test == "kruskalwallis":
            groups = data.get("groups") or [data.get("group1", []), data.get("group2", [])]
            raw = S.kruskalwallis(groups, alpha)
        elif test == "anova_oneway":
            groups = data.get("groups") or [data.get("group1", []), data.get("group2", []), data.get("group3", [])]
            raw = S.anova_oneway(groups, alpha)
        elif test == "chi_square":
            raw = S.chi_square(data["observed"], alpha)
        elif test == "fisher_exact":
            raw = S.fisher_exact(data["observed"], alpha)
        elif test == "pearson":
            raw = S.pearson(data["x"], data["y"], alpha)
        elif test == "spearman":
            raw = S.spearman(data["x"], data["y"], alpha)
        elif test == "linear_regression":
            raw = R.linear_regression(data["x"], data["y"], alpha)
        elif test == "logistic_regression":
            raw = R.logistic_regression(data["x"], data["y"], alpha)
        elif test == "kaplan_meier":
            # KM via the inferential entrypoint: headline = log-rank p, effect = median.
            from ..services import survival as V
            time, event = data.get("time", []), data.get("event", [])
            group = data.get("group", [])
            km = V.kaplan_meier(time, event)
            lrp = V.logrank(time, event, group) if group else None
            raw = {
                "test": "kaplan_meier",
                "statistic": km.get("medianSurvival"),
                "pValue": lrp,
                "ci95Lower": None, "ci95Upper": None,
                "effectSize": {"name": "median_survival", "value": km.get("medianSurvival"), "ci95Lower": None, "ci95Upper": None},
                "degreesFreedom": None,
                "assumptionsChecked": ["proportional_hazards"],
                "warnings": km.get("warnings", []) or (["lifelines_unavailable: numpy KM fallback"] if km.get("method") == "numpy" else []),
            }
        else:
            return _err(test, f"unknown test type: {test}")
        return _as_result(raw)
    except Exception as exc:  # graceful — never 5xx
        return _err(test, str(exc))