# apps/stats-service/app/schemas.py
# Pydantic v2 schemas mirroring @medicore/contracts Zod schemas (spec §1, §2).
# Kept in lock-step (manually today; a zod→pydantic codegen is tracked as an
# open question in the design doc) so the TS client and Python service agree
# on every field name and nullability.

from __future__ import annotations

from typing import Any, List, Literal, Optional

from pydantic import BaseModel, Field


# ─────────────────────────────────────────────
# Enums (mirror InferentialTestTypeSchema)
# ─────────────────────────────────────────────

InferentialTest = Literal[
    "ttest_independent",
    "ttest_paired",
    "mannwhitney",
    "kruskalwallis",
    "anova_oneway",
    "chi_square",
    "fisher_exact",
    "pearson",
    "spearman",
    "linear_regression",
    "logistic_regression",
    "kaplan_meier",
]

SharePermission = Literal["view", "edit"]
TimeSeriesPeriod = Literal["month", "quarter", "year"]


# ─────────────────────────────────────────────
# Inferential (POST /internal/stats/inferential)
# ─────────────────────────────────────────────

class AssumptionWarning(BaseModel):
    code: str
    message: str
    suggestion: Optional[str] = None


class EffectSize(BaseModel):
    name: str
    value: Optional[float] = None
    ci95Lower: Optional[float] = None
    ci95Upper: Optional[float] = None


class StatisticalTestResult(BaseModel):
    test: InferentialTest
    statistic: Optional[float] = None
    pValue: Optional[float] = None
    ci95Lower: Optional[float] = None
    ci95Upper: Optional[float] = None
    effectSize: Optional[EffectSize] = None
    degreesFreedom: Optional[int] = None
    assumptionsChecked: List[str] = Field(default_factory=list)
    warnings: List[AssumptionWarning] = Field(default_factory=list)


class InferentialRequest(BaseModel):
    test: InferentialTest
    # `data` is a catch-all: holds group1/group2/paired for comparison tests,
    # observed (2d) for chi/fisher, x/y for correlation/regression, and the
    # cohort shape (queryId/fields resolved by the API) for KM. Mirrors the
    # Zod `.catchall(z.unknown())` on InferentialRequestSchema.data.
    data: dict = Field(default_factory=dict)
    alpha: float = 0.05

    model_config = {"extra": "allow"}


# ─────────────────────────────────────────────
# Survival (POST /internal/survival)
# ─────────────────────────────────────────────

class SurvivalCurvePoint(BaseModel):
    time: float
    survival: float
    ciLower: Optional[float] = None
    ciUpper: Optional[float] = None
    nAtRisk: int
    nEvents: int


class SurvivalRequest(BaseModel):
    timeField: str
    eventField: str
    data: dict = Field(default_factory=dict)
    alpha: float = 0.05
    model_config = {"extra": "allow"}


class SurvivalResult(BaseModel):
    timePoints: List[float]
    survival: List[float]
    ciLower: List[float]
    ciUpper: List[float]
    riskTable: List[SurvivalCurvePoint]
    logRankP: Optional[float] = None
    medianSurvival: Optional[float] = None
    warnings: List[str] = Field(default_factory=list)


# ─────────────────────────────────────────────
# Cross-tab (POST /internal/cross-tab)
# ─────────────────────────────────────────────

class CrossTabCell(BaseModel):
    count: int
    suppressed: bool = False  # BR-RES-004


class CrossTabRequest(BaseModel):
    rowField: str
    colField: str
    data: dict = Field(default_factory=dict)
    model_config = {"extra": "allow"}


class CrossTabResult(BaseModel):
    rowField: str
    colField: str
    rows: List[str]
    cols: List[str]
    cells: List[List[CrossTabCell]]
    rowTotals: List[int]
    colTotals: List[int]
    grandTotal: int
    chiSquare: Optional[float] = None
    chiSquareP: Optional[float] = None
    fisherExactP: Optional[float] = None
    oddsRatio: Optional[float] = None
    oddsRatioCi95: Optional[List[float]] = None
    warnings: List[str] = Field(default_factory=list)