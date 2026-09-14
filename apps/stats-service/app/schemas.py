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


# ─────────────────────────────────────────────
# Normality (POST /internal/stats/normality, /wilcoxon, /describe-auto) — V3 M2
# ─────────────────────────────────────────────

class NormalityRequest(BaseModel):
    values: List[float] = Field(default_factory=list)
    alpha: float = 0.05

class NormalityResult(BaseModel):
    statistic: Optional[float] = None
    pValue: Optional[float] = None
    isNormal: bool = False
    n: int = 0
    warnings: List[str] = Field(default_factory=list)

class WilcoxonRequest(BaseModel):
    pre: List[float] = Field(default_factory=list)
    post: List[float] = Field(default_factory=list)
    alpha: float = 0.05

class WilcoxonResult(BaseModel):
    statistic: Optional[float] = None
    pValue: Optional[float] = None
    z: Optional[float] = None
    n: int = 0
    warnings: List[str] = Field(default_factory=list)

class DescribeAutoRequest(BaseModel):
    values: List[float] = Field(default_factory=list)
    alpha: float = 0.05

class DescribeAutoResult(BaseModel):
    representation: str  # "mean_sd" | "median_iqr"
    mean: Optional[float] = None
    sd: Optional[float] = None
    median: Optional[float] = None
    q1: Optional[float] = None
    q3: Optional[float] = None
    n: int = 0
    normality: Optional[NormalityResult] = None
    warnings: List[str] = Field(default_factory=list)


# ─────────────────────────────────────────────
# Guided analysis: relative risk + p-value adjustment
# ─────────────────────────────────────────────

class RelativeRiskRequest(BaseModel):
    exposedCases: int
    exposedNonCases: int
    unexposedCases: int
    unexposedNonCases: int
    alpha: float = 0.05


class RelativeRiskResult(BaseModel):
    relativeRisk: Optional[float] = None
    ci95Lower: Optional[float] = None
    ci95Upper: Optional[float] = None
    oddsRatio: Optional[float] = None
    orCi95Lower: Optional[float] = None
    orCi95Upper: Optional[float] = None
    exposedCases: int
    exposedNonCases: int
    unexposedCases: int
    unexposedNonCases: int
    suppressed: bool = False
    suppressReason: Optional[str] = None
    warnings: List[AssumptionWarning] = Field(default_factory=list)


PAdjustMethod = Literal["holm", "fdr"]


class PAdjustRequest(BaseModel):
    method: PAdjustMethod = "holm"
    pValues: List[float] = Field(default_factory=list)


class PAdjustResult(BaseModel):
    method: PAdjustMethod
    originalP: List[float]
    adjustedP: List[float]
    n: int