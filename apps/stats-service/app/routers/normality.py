# apps/stats-service/app/routers/normality.py
# Normality + describe-auto router (V3 M2). State-less endpoints that the TS
# PythonStatsService calls for Table-1 automatic statistic selection:
#   POST /internal/stats/normality    — Shapiro-Wilk (scipy.stats.shapiro)
#   POST /internal/stats/wilcoxon     — Wilcoxon signed-rank (scipy.stats.wilcoxon)
#   POST /internal/stats/describe-auto — auto select mean±SD or median(IQR)
# Graceful on error (never 5xx) — returns a warning envelope like the
# inferential router (BR-RES-005).

from __future__ import annotations

import math
from typing import List

import numpy as np
from fastapi import APIRouter

from ..schemas import (
    NormalityRequest, NormalityResult,
    WilcoxonRequest, WilcoxonResult,
    DescribeAutoRequest, DescribeAutoResult,
)

router = APIRouter()


def _shapiro(values: List[float], alpha: float) -> NormalityResult:
    """Shapiro-Wilk normality test. Falls back to scipy if available; otherwise
    uses a skewness/kurtosis heuristic so the service degrades gracefully."""
    arr = [float(v) for v in values if v is not None and math.isfinite(float(v))]
    n = len(arr)
    if n < 3:
        return NormalityResult(statistic=None, pValue=None, isNormal=False, n=n,
                               warnings=["insufficient_sample_size"])
    try:
        from scipy.stats import shapiro as _shapiro  # type: ignore
        stat, p = _shapiro(arr)
        return NormalityResult(statistic=float(stat), pValue=float(p),
                               isNormal=float(p) > alpha, n=n)
    except Exception:
        # Heuristic fallback — proxy via skew/kurtosis
        a = np.array(arr, dtype=float)
        mean = float(a.mean())
        sd = float(a.std(ddof=1)) if n > 1 else 0.0
        if sd == 0:
            return NormalityResult(statistic=None, pValue=None, isNormal=True, n=n)
        skew = float(((a - mean) ** 3).mean() / (sd ** 3))
        kurt = float(((a - mean) ** 4).mean() / (sd ** 4)) - 3.0
        # Approximate test: |skew| < 0.5 and |kurt| < 1.5 → normal-ish
        is_normal = abs(skew) < 0.5 and abs(kurt) < 1.5
        return NormalityResult(statistic=None, pValue=None, isNormal=is_normal, n=n,
                               warnings=["scipy_unavailable_heuristic_fallback"])


@router.post("/internal/stats/normality")
def normality(req: NormalityRequest) -> NormalityResult:
    try:
        return _shapiro(req.values, req.alpha)
    except Exception as exc:
        return NormalityResult(statistic=None, pValue=None, isNormal=False, n=len(req.values),
                               warnings=[f"fit_error:{exc}"])


def _wilcoxon(pre: List[float], post: List[float], alpha: float) -> WilcoxonResult:
    if len(pre) != len(post):
        return WilcoxonResult(statistic=None, pValue=None, z=None, n=min(len(pre), len(post)),
                              warnings=["length_mismatch_pre_post"])
    diff = [float(b) - float(a) for a, b in zip(pre, post)]
    n = len(diff)
    if n < 3:
        return WilcoxonResult(statistic=None, pValue=None, z=None, n=n,
                              warnings=["insufficient_sample_size"])
    try:
        from scipy.stats import wilcoxon  # type: ignore
        result = wilcoxon(post, pre)  # paired differences
        stat = float(result.statistic)
        p = float(result.pvalue)
        z = float(result.zstatistic) if hasattr(result, "zstatistic") else None
        return WilcoxonResult(statistic=stat, pValue=p, z=z, n=n)
    except Exception:
        # Sign-test fallback
        positives = sum(1 for d in diff if d > 0)
        p = 2 * min(positives, n - positives) if n else None
        return WilcoxonResult(statistic=float(positives), pValue=None, z=None, n=n,
                              warnings=["scipy_unavailable_sign_test_fallback"])


@router.post("/internal/stats/wilcoxon")
def wilcoxon(req: WilcoxonRequest) -> WilcoxonResult:
    try:
        return _wilcoxon(req.pre, req.post, req.alpha)
    except Exception as exc:
        return WilcoxonResult(statistic=None, pValue=None, z=None,
                              n=min(len(req.pre), len(req.post)),
                              warnings=[f"fit_error:{exc}"])


@router.post("/internal/stats/describe-auto")
def describe_auto(req: DescribeAutoRequest) -> DescribeAutoResult:
    arr = [float(v) for v in req.values if v is not None and math.isfinite(float(v))]
    n = len(arr)
    if n < 3:
        return DescribeAutoResult(representation="median_iqr", mean=None, sd=None,
                                 median=None, q1=None, q3=None, n=n,
                                 warnings=["insufficient_sample_size"])
    a = np.array(arr, dtype=float)
    norm = _shapiro(arr, req.alpha)
    if norm.isNormal:
        mean = float(a.mean())
        sd = float(a.std(ddof=1)) if n > 1 else 0.0
        return DescribeAutoResult(representation="mean_sd", mean=round(mean, 4),
                                  sd=round(sd, 4), median=None, q1=None, q3=None,
                                  n=n, normality=norm)
    s = np.sort(a)
    median = float(np.median(s))
    q1 = float(np.percentile(s, 25))
    q3 = float(np.percentile(s, 75))
    return DescribeAutoResult(representation="median_iqr", mean=float(a.mean()),
                              sd=float(a.std(ddof=1)) if n > 1 else 0.0,
                              median=round(median, 4), q1=round(q1, 4),
                              q3=round(q3, 4), n=n, normality=norm)