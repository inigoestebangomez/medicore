# apps/stats-service/app/services/agreement.py
# Agreement / reliability statistics for the Research V4 form builder
# (REQ-FB-010): Cohen's Kappa (two raters, categorical), ICC (two-way random,
# single measures, Shrout & Fleiss 1979) and Cronbach's alpha (internal
# consistency).
#
# Implemented with numpy + scipy only — scikit-learn / pingouin are NOT in
# requirements.txt, so the closed-form formulas are used directly. Every
# function returns a dict shaped like the TS `AgreementResult` contract
# ({ statistic, pValue, n, warnings }) so the FastAPI router can pass it
# straight through.

from __future__ import annotations

from typing import Any, Dict, List, Sequence

import numpy as np
from scipy import stats as scistats


def _warn(msg: str) -> List[str]:
    return [msg]


def kappa_cohen(rater_a: Sequence[Any], rater_b: Sequence[Any], alpha: float = 0.05) -> Dict[str, Any]:
    """Cohen's Kappa for two raters over the same nominal subjects.

    Closed-form via the confusion matrix (Fleiss, Levin & Paik "Statistical
    Methods for Rates and Proportions"). The asymptotic standard error gives
    a z-test and 95% CI.
    """
    a = list(rater_a)
    b = list(rater_b)
    n = len(a)
    if n == 0 or n != len(b):
        return {"statistic": None, "pValue": None, "n": n, "warnings": _warn("kappa: raters must have equal length > 0")}
    labels = sorted(set(a) | set(b))
    k = len(labels)
    if k < 2:
        # All ratings identical — perfect agreement by definition.
        return {"statistic": 1.0 if n > 1 else None, "pValue": None, "n": n, "warnings": _warn("kappa: single category — trivial agreement")}
    idx = {lab: i for i, lab in enumerate(labels)}
    mat = np.zeros((k, k), dtype=float)
    for x, y in zip(a, b):
        mat[idx[x], idx[y]] += 1
    po = np.trace(mat) / n
    row = mat.sum(axis=1) / n
    col = mat.sum(axis=0) / n
    pe = float(np.dot(row, col))
    denom = 1.0 - pe
    if denom == 0:
        return {"statistic": None, "pValue": None, "n": n, "warnings": _warn("kappa: expected agreement == 1 — kappa undefined")}
    kappa = float((po - pe) / denom)
    # Asymptotic SE (Fleiss large-sample) and z-test for H0: kappa = 0.
    se = float(np.sqrt((pe * (1 - pe)) / (denom * denom * n)))
    z = kappa / se if se > 0 else None
    p = float(2 * (1 - scistats.norm.cdf(abs(z)))) if z is not None else None
    warnings: List[str] = []
    if n < 20:
        warnings.append("kappa: small sample — asymptotic CI is approximate (n < 20)")
    return {"statistic": kappa, "pValue": p, "n": n, "warnings": warnings}


def icc_two_way(values_by_rater: Sequence[Sequence[float]], alpha: float = 0.05) -> Dict[str, Any]:
    """ICC(2,1) — two-way random, single measures (Shrout & Fleiss 1979).

    `values_by_rater` is k rows (one per rater) × n columns (subjects). Returns
    the ICC point estimate, an F-test p-value (H0: subjects exchangeable, i.e.
    no subject effect), and the subject count.
    """
    m = np.array(values_by_rater, dtype=float)
    if m.size == 0 or m.ndim != 2:
        return {"statistic": None, "pValue": None, "n": 0, "warnings": _warn("icc: values_by_rater must be a 2D list of raters x subjects")}
    k, n = m.shape  # raters, subjects
    if k < 2 or n < 2:
        return {"statistic": None, "pValue": None, "n": n, "warnings": _warn("icc: need >= 2 raters and >= 2 subjects")}
    grand = m.mean()
    ss_subjects = k * float(np.sum((m.mean(axis=0) - grand) ** 2))
    ss_raters = n * float(np.sum((m.mean(axis=1) - grand) ** 2))
    ss_total = float(np.sum((m - grand) ** 2))
    ss_error = ss_total - ss_subjects - ss_raters
    df_subjects = n - 1
    df_raters = k - 1
    df_error = df_subjects * df_raters
    if df_error <= 0 or ss_error < 0:
        return {"statistic": None, "pValue": None, "n": n, "warnings": _warn("icc: insufficient degrees of freedom")}
    ms_subjects = ss_subjects / df_subjects if df_subjects > 0 else 0.0
    ms_raters = ss_raters / df_raters if df_raters > 0 else 0.0
    ms_error = ss_error / df_error
    denom = ms_subjects + (k - 1) * ms_error + k * max(ms_raters - ms_error, 0.0) / n
    if denom == 0:
        return {"statistic": None, "pValue": None, "n": n, "warnings": _warn("icc: zero variance — ICC undefined")}
    icc = float((ms_subjects - ms_error) / denom)
    # F-test on the subject mean square — H0: no between-subject variance.
    f = ms_subjects / ms_error if ms_error > 0 else None
    p = float(scistats.f.sf(f, df_subjects, df_error)) if f is not None else None
    warnings: List[str] = []
    if n < 20:
        warnings.append("icc: small sample — CI approximate (n < 20)")
    return {"statistic": icc, "pValue": p, "n": n, "warnings": warnings}


def cronbach_alpha(items_by_subject: Sequence[Sequence[float]], alpha: float = 0.05) -> Dict[str, Any]:
    """Cronbach's alpha for internal consistency of a multi-item scale.

    `items_by_subject` is one row per subject, each row the subject's item
    scores. Alpha has no standard significance test, so pValue is null.
    """
    m = np.array(items_by_subject, dtype=float)
    if m.size == 0 or m.ndim != 2:
        return {"statistic": None, "pValue": None, "n": 0, "warnings": _warn("cronbach: items_by_subject must be a 2D list of subjects x items")}
    n, k = m.shape  # subjects, items
    if k < 2:
        return {"statistic": None, "pValue": None, "n": n, "warnings": _warn("cronbach: need >= 2 items")}
    item_var = np.var(m, axis=0, ddof=1) if n > 1 else np.var(m, axis=0, ddof=0)
    total = m.sum(axis=1)
    total_var = float(np.var(total, ddof=1)) if n > 1 else 0.0
    sum_var = float(np.sum(item_var))
    if total_var == 0:
        return {"statistic": None, "pValue": None, "n": n, "warnings": _warn("cronbach: zero total variance — alpha undefined")}
    a = float((k / (k - 1)) * (1 - sum_var / total_var))
    warnings: List[str] = ["cronbach: no asymptotic p-value (alpha has no standard significance test)"]
    if n < 20:
        warnings.append("cronbach: small sample — estimate unstable (n < 20)")
    return {"statistic": a, "pValue": None, "n": n, "warnings": warnings}