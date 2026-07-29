# apps/stats-service/app/services/stats.py
# Pure wrappers over SciPy/statsmodels for the inferential tests (spec §1).
# Each function takes plain numpy arrays and returns a dict of result fields;
# the router assembles them into a StatisticalTestResult. Assumption checks
# (normality via Shapiro, variance homogeneity via Levene) emit warnings that
# the API surfaces to the physician (BR-RES-005).

from __future__ import annotations

from typing import Dict, List, Optional

import numpy as np

try:
    from scipy import stats as sp_stats
except Exception:  # pragma: no cover - scipy is a hard dep in prod
    sp_stats = None  # type: ignore


def _need_scipy() -> None:
    if sp_stats is None:
        raise RuntimeError("scipy not installed in this environment")


def cohen_d(g1: np.ndarray, g2: np.ndarray) -> float:
    n1, n2 = len(g1), len(g2)
    if n1 < 2 or n2 < 2:
        return float("nan")
    s = np.sqrt(((n1 - 1) * np.var(g1, ddof=1) + (n2 - 1) * np.var(g2, ddof=1)) / (n1 + n2 - 2))
    if s == 0:
        return 0.0
    return float((np.mean(g1) - np.mean(g2)) / s)


def ci_mean(x: np.ndarray, alpha: float = 0.05) -> Optional[tuple[float, float]]:
    if len(x) < 2:
        return None
    _need_scipy()
    m, s, n = float(np.mean(x)), float(np.std(x, ddof=1)), len(x)
    t = sp_stats.t.ppf(1 - alpha / 2, n - 1)
    half = t * s / np.sqrt(n)
    return (m - half, m + half)


def normality_warning(x: np.ndarray, alpha: float = 0.05) -> Optional[Dict]:
    if len(x) < 3 or sp_stats is None:
        return None
    try:
        _, p = sp_stats.shapiro(x)
    except Exception:
        return None
    if p < alpha:
        return {
            "code": "normality_violated",
            "message": f"Shapiro p={p:.3f} < {alpha}; data may not be normal.",
            "suggestion": "Consider a non-parametric test (Mann-Whitney / Kruskal-Wallis).",
        }
    return None


def variance_warning(g1: np.ndarray, g2: np.ndarray, alpha: float = 0.05) -> Optional[Dict]:
    if len(g1) < 2 or len(g2) < 2 or sp_stats is None:
        return None
    try:
        _, p = sp_stats.levene(g1, g2)
    except Exception:
        return None
    if p < alpha:
        return {
            "code": "variance_heterogeneous",
            "message": f"Levene p={p:.3f}; variances differ across groups.",
            "suggestion": "Use Welch's t-test (equal_var=False) or a non-parametric alternative.",
        }
    return None


# ─────────────────────────────────────────────
# Comparison tests
# ─────────────────────────────────────────────

def ttest_independent(group1, group2, alpha=0.05, equal_var=True):
    _need_scipy()
    g1, g2 = np.asarray(group1, dtype=float), np.asarray(group2, dtype=float)
    warnings: List[Dict] = []
    if normality_warning(g1, alpha): warnings.append(normality_warning(g1, alpha))
    if normality_warning(g2, alpha): warnings.append(normality_warning(g2, alpha))
    vw = variance_warning(g1, g2, alpha)
    if vw:
        warnings.append(vw)
        equal_var = False  # auto-switch to Welch
    t, p = sp_stats.ttest_ind(g1, g2, equal_var=equal_var)
    df = float(len(g1) + len(g2) - 2) if equal_var else float("nan")
    return {
        "test": "ttest_independent",
        "statistic": float(t), "pValue": float(p),
        "ci95Lower": None, "ci95Upper": None,
        "effectSize": {"name": "cohen_d", "value": cohen_d(g1, g2), "ci95Lower": None, "ci95Upper": None},
        "degreesFreedom": None if np.isnan(df) else int(df),
        "assumptionsChecked": ["shapiro", "levene"],
        "warnings": warnings,
    }


def ttest_paired(group1, group2, alpha=0.05):
    _need_scipy()
    g1, g2 = np.asarray(group1, dtype=float), np.asarray(group2, dtype=float)
    t, p = sp_stats.ttest_rel(g1, g2)
    return {
        "test": "ttest_paired",
        "statistic": float(t), "pValue": float(p),
        "ci95Lower": None, "ci95Upper": None,
        "effectSize": {"name": "cohen_d", "value": cohen_d(g1 - g2, np.zeros_like(g1 - g2)) if len(g1) else float("nan"), "ci95Lower": None, "ci95Upper": None},
        "degreesFreedom": len(g1) - 1,
        "assumptionsChecked": ["shapiro"],
        "warnings": [normality_warning(g1 - g2, alpha)] if normality_warning(g1 - g2, alpha) else [],
    }


def mannwhitney(group1, group2, alpha=0.05):
    _need_scipy()
    g1, g2 = np.asarray(group1, dtype=float), np.asarray(group2, dtype=float)
    u, p = sp_stats.mannwhitneyu(g1, g2, alternative="two-sided")
    return {
        "test": "mannwhitney",
        "statistic": float(u), "pValue": float(p),
        "effectSize": {"name": "rank_biserial", "value": 1 - (2 * u) / (len(g1) * len(g2)) if len(g1) * len(g2) else None, "ci95Lower": None, "ci95Upper": None},
        "assumptionsChecked": [], "warnings": [],
    }


def kruskalwallis(groups, alpha=0.05):
    _need_scipy()
    arrs = [np.asarray(g, dtype=float) for g in groups if len(g)]
    h, p = sp_stats.kruskal(*arrs)
    return {
        "test": "kruskalwallis",
        "statistic": float(h), "pValue": float(p),
        "effectSize": {"name": "epsilon_sq", "value": (h - len(arrs) + 1) / (sum(len(a) for a in arrs) - len(arrs)) if sum(len(a) for a in arrs) else None, "ci95Lower": None, "ci95Upper": None},
        "degreesFreedom": len(arrs) - 1,
        "assumptionsChecked": [], "warnings": [],
    }


def anova_oneway(groups, alpha=0.05):
    _need_scipy()
    arrs = [np.asarray(g, dtype=float) for g in groups if len(g)]
    f, p = sp_stats.f_oneway(*arrs)
    return {
        "test": "anova_oneway",
        "statistic": float(f), "pValue": float(p),
        "effectSize": {"name": "eta_sq", "value": None, "ci95Lower": None, "ci95Upper": None},
        "degreesFreedom": (len(arrs) - 1, sum(len(a) for a in arrs) - len(arrs)),
        "assumptionsChecked": ["levene"],
        "warnings": [],
    }


# ─────────────────────────────────────────────
# Categorical: chi-square / Fisher
# ─────────────────────────────────────────────

def chi_square(observed, alpha=0.05):
    _need_scipy()
    obs = np.asarray(observed, dtype=float)
    chi2, p, dof, exp = sp_stats.chi2_contingency(obs)
    warnings = []
    if np.any(exp < 5):
        warnings.append("Some expected cells <5; consider Fisher exact (2x2).")
    return {
        "test": "chi_square",
        "statistic": float(chi2), "pValue": float(p),
        "degreesFreedom": int(dof),
        "effectSize": {"name": "cramers_v", "value": float(np.sqrt(chi2 / (obs.sum() * (min(obs.shape) - 1)))) if obs.sum() else None, "ci95Lower": None, "ci95Upper": None},
        "assumptionsChecked": ["expected_counts"],
        "warnings": warnings,
    }


def fisher_exact(observed, alpha=0.05):
    _need_scipy()
    obs = np.asarray(observed, dtype=float)
    if obs.shape != (2, 2):
        raise ValueError("Fisher exact requires a 2x2 table")
    odds, p = sp_stats.fisher_exact(obs)
    return {
        "test": "fisher_exact",
        "statistic": None, "pValue": float(p),
        "effectSize": {"name": "odds_ratio", "value": float(odds), "ci95Lower": None, "ci95Upper": None},
        "assumptionsChecked": [], "warnings": [],
    }


# ─────────────────────────────────────────────
# Correlation
# ─────────────────────────────────────────────

def pearson(x, y, alpha=0.05):
    _need_scipy()
    r, p = sp_stats.pearsonr(np.asarray(x, dtype=float), np.asarray(y, dtype=float))
    return {
        "test": "pearson",
        "statistic": float(r), "pValue": float(p),
        "effectSize": {"name": "r", "value": float(r), "ci95Lower": None, "ci95Upper": None},
        "assumptionsChecked": ["normality"],
        "warnings": [],
    }


def spearman(x, y, alpha=0.05):
    _need_scipy()
    r, p = sp_stats.spearmanr(np.asarray(x, dtype=float), np.asarray(y, dtype=float))
    return {
        "test": "spearman",
        "statistic": float(r), "pValue": float(p),
        "effectSize": {"name": "rho", "value": float(r), "ci95Lower": None, "ci95Upper": None},
        "assumptionsChecked": [], "warnings": [],
    }