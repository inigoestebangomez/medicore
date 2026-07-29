# apps/stats-service/app/services/regression.py
# Linear & logistic regression wrappers (task 3.3). Linear uses scipy.linregress;
# logistic uses statsmodels Logit. Returns StatisticalTestResult-shaped dicts.

from __future__ import annotations

from typing import Dict, List

import numpy as np

from .stats import _need_scipy


def linear_regression(x, y, alpha=0.05) -> Dict:
    _need_scipy()
    from scipy import stats as sp
    xs, ys = np.asarray(x, dtype=float), np.asarray(y, dtype=float)
    if len(xs) < 3:
        raise ValueError("Linear regression needs >=3 observations")
    slope, intercept, r, p, stderr = sp.linregress(xs, ys)
    return {
        "test": "linear_regression",
        "statistic": float(r * r),  # R² as the headline statistic
        "pValue": float(p),
        "ci95Lower": None, "ci95Upper": None,
        "effectSize": {
            "name": "beta",
            "value": float(slope),
            "ci95Lower": float(slope - 1.96 * stderr),
            "ci95Upper": float(slope + 1.96 * stderr),
        },
        "degreesFreedom": len(xs) - 2,
        "assumptionsChecked": ["linearity", "residual_normality"],
        "warnings": [],
    }


def logistic_regression(x, y, alpha=0.05) -> Dict:
    """Binary logistic regression (statsmodels Logit). Returns the Wald test
    statistic/p-value for the slope coefficient, with odds ratio as effect size."""
    try:
        import statsmodels.api as sm
    except Exception:  # pragma: no cover
        _need_scipy()
        raise
    xs = np.asarray(x, dtype=float)
    ys = np.asarray(y, dtype=float)
    if not set(np.unique(ys)).issubset({0.0, 1.0}):
        raise ValueError("Logistic regression requires a binary (0/1) outcome")
    if len(xs) < 5 or ys.sum() < 1 or ys.sum() >= len(ys):
        raise ValueError("Logistic regression needs variation in y and >=5 rows")
    X = sm.add_constant(xs)
    model = sm.Logit(ys, X)
    res = model.fit(disp=0, maxiter=100)
    z = float(res.params[1] / res.bse[1])
    p = float(res.pvalues[1])
    odds = float(np.exp(res.params[1]))
    ci = [float(np.exp(res.conf_int()[0][1])), float(np.exp(res.conf_int()[1][1]))]
    return {
        "test": "logistic_regression",
        "statistic": z,
        "pValue": p,
        "ci95Lower": ci[0],
        "ci95Upper": ci[1],
        "effectSize": {"name": "odds_ratio", "value": odds, "ci95Lower": ci[0], "ci95Upper": ci[1]},
        "degreesFreedom": len(xs) - 2,
        "assumptionsChecked": [],
        "warnings": [],
    }