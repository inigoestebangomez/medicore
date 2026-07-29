# apps/stats-service/app/services/survival.py
# Kaplan-Meier estimation + log-rank test (task 3.3). lifelines is the primary
# engine (production dep); a pure-numpy fallback computes the KM step function
# and a log-rank score so the service still answers in environments where
# lifelines isn't installed (tests/CI), per the graceful-degradation design.

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

import numpy as np

try:
    from lifelines import KaplanMeierFitter
    from lifelines.statistics import logrank_test
    _LIFELINES = True
except Exception:  # pragma: no cover - optional in CI
    _LIFELINES = False  # type: ignore


def _km_numpy(time: np.ndarray, event: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray, List[int], List[int]]:
    """Pure-numpy KM step function with Greenwood CI (without lifelines)."""
    order = np.argsort(time)
    t, e = time[order], event[order]
    unique_t = np.unique(t)
    survival, ci_lo, ci_hi = [], [], []
    s = 1.0
    cum_var = 0.0
    risk_at, events_at = [], []
    for ti in unique_t:
        at_risk = int(np.sum(t >= ti))
        d = int(np.sum((t == ti) & (e == 1)))
        if at_risk > 0:
            s *= (1 - d / at_risk)
            if s > 0:
                cum_var += (d / at_risk) / (at_risk - d) if (at_risk - d) > 0 else 0
        se = np.sqrt(max(cum_var, 0.0))
        survival.append(s)
        ci_lo.append(max(0.0, s - 1.96 * se))
        ci_hi.append(min(1.0, s + 1.96 * se))
        risk_at.append(at_risk)
        events_at.append(d)
    return unique_t, survival, ci_lo, ci_hi, events_at  # type: ignore[return-value]


def median_survival(time_pts: np.ndarray, survival: np.ndarray) -> Optional[float]:
    idx = np.where(survival <= 0.5)[0]
    if len(idx) == 0:
        return None
    return float(time_pts[idx[0]])


def kaplan_meier(time_data, event_data) -> Dict:
    t = np.asarray(time_data, dtype=float)
    e = np.asarray(event_data, dtype=float)
    valid = t >= 0
    t, e = t[valid], e[valid]

    if _LIFELINES:
        kmf = KaplanMeierFitter()
        kmf.fit(t, e)
        time_points = kmf.survival_function_.index.values
        surv = kmf.survival_function_.values[:, 0]
        ci = kmf.confidence_interval_.values
        ci_lo, ci_hi = ci[:, 0], ci[:, 1]
        risk_table = []
        for tp, sv in zip(time_points, surv):
            at_risk = int(np.sum(t >= tp))
            events_at = int(np.sum((t == tp) & (e == 1)))
            risk_table.append({
                "time": float(tp), "survival": float(sv),
                "ciLower": None, "ciUpper": None,
                "nAtRisk": at_risk, "nEvents": events_at,
            })
        median = float(kmf.median_survival_time_) if np.isfinite(kmf.median_survival_time_) else None
        return {
            "method": "lifelines",
            "timePoints": [float(x) for x in time_points],
            "survival": [float(x) for x in surv],
            "ciLower": [float(x) for x in ci_lo],
            "ciUpper": [float(x) for x in ci_hi],
            "riskTable": risk_table,
            "medianSurvival": median,
        }

    # numpy fallback
    tp, sv, clo, chi, events = _km_numpy(t, e)
    risk = [int(np.sum(t >= x)) for x in tp]
    risk_table = [
        {
            "time": float(tp[i]), "survival": float(sv[i]),
            "ciLower": float(clo[i]), "ciUpper": float(chi[i]),
            "nAtRisk": risk[i], "nEvents": int(events[i]),
        }
        for i in range(len(tp))
    ]
    return {
        "method": "numpy",
        "timePoints": [float(x) for x in tp],
        "survival": [float(x) for x in sv],
        "ciLower": [float(x) for x in clo],
        "ciUpper": [float(x) for x in chi],
        "riskTable": risk_table,
        "medianSurvival": median_survival(tp, np.asarray(sv)),
    }


def logrank(time_data, event_data, group_data) -> Optional[float]:
    """Two-sample log-rank p-value. group_data codes group membership (0/1)."""
    t = np.asarray(time_data, dtype=float)
    e = np.asarray(event_data, dtype=float)
    g = np.asarray(group_data, dtype=float)
    if t.shape[0] < 2 or len(np.unique(g)) < 2:
        return None
    if _LIFELINES:
        mask1 = g == 1
        res = logrank_test(t[mask1], t[~mask1], e[mask1], e[~mask1])
        return float(res.p_value)

    # Pure-numpy Mantel-Cox log-rank score → p from chi-square dist.
    from scipy import stats  # type: ignore
    unique_t = np.unique(t)
    O1 = E1 = 0.0
    n1 = int(np.sum(g == 1))
    n2 = int(np.sum(g == 0))
    for ti in unique_t:
        n_j = int(np.sum(t == ti))
        m_j = int(np.sum((t == ti) & (e == 1)))
        n1j = int(np.sum((t == ti) & (g == 1)))
        if (n1 * 1 + n2 * 1) == 0 or n_j == 0:
            continue
        e1j = n1j * m_j / max(n_j, 1)
        E1 += e1j
        d1 = int(np.sum((t == ti) & (e == 1) & (g == 1)))
        O1 += d1
    chi = (O1 - E1) ** 2 / max(E1, 1e-9)
    return float(1 - stats.chi2.cdf(chi, 1))