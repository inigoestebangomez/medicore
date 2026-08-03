// apps/api/src/domain/research/statistical-analysis.entity.ts
// Domain entity: StatisticalAnalysis — persisted per-run traceability record
// (REQ-FB-012) and risk/protective factor labelling (REQ-FB-011).

import { RiskFactorLabelVO } from './value-objects/risk-factor-label.vo';

export interface StatisticalAnalysisProps {
  id: string;
  organizationId: string;
  studyId: string;
  test: string;
  variableIds: string[];
  params?: Record<string, unknown>;
  statistic?: number | null;
  pValue?: number | null;
  ci95?: { lower: number; upper: number } | null;
  effectSize?: Record<string, unknown> | null;
  n: number;
  riskLabel?: string | null;
  executedAt?: Date;
}

export class StatisticalAnalysis {
  readonly id: string;
  readonly organizationId: string;
  readonly studyId: string;
  readonly test: string;
  readonly variableIds: string[];
  readonly params: Record<string, unknown>;
  readonly statistic: number | null;
  readonly pValue: number | null;
  readonly ci95: { lower: number; upper: number } | null;
  readonly effectSize: Record<string, unknown> | null;
  readonly n: number;
  readonly riskLabel: RiskFactorLabelVO | null;
  readonly executedAt: Date;

  constructor(props: StatisticalAnalysisProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.studyId = props.studyId;
    this.test = props.test;
    this.variableIds = props.variableIds;
    this.params = props.params ?? {};
    this.statistic = props.statistic ?? null;
    this.pValue = props.pValue ?? null;
    this.ci95 = props.ci95 ?? null;
    this.effectSize = props.effectSize ?? null;
    this.n = props.n;
    this.riskLabel = props.riskLabel ? RiskFactorLabelVO.create(props.riskLabel) : null;
    this.executedAt = props.executedAt ?? new Date();
  }

  static create(props: {
    id: string;
    organizationId: string;
    studyId: string;
    test: string;
    variableIds: string[];
    params?: Record<string, unknown>;
    n: number;
    statistic?: number | null;
    pValue?: number | null;
    ci95?: { lower: number; upper: number } | null;
    effectSize?: Record<string, unknown> | null;
  }): StatisticalAnalysis {
    return new StatisticalAnalysis(props);
  }

  /**
   * Label an association as risk/protective factor based on the effect
   * estimate (OR/HR) and the p-value (REQ-FB-011). OR/HR > 1 → RISK_FACTOR,
   * < 1 → PROTECTIVE_FACTOR, else NEUTRAL (non-significant stays NEUTRAL).
   * Returns a new entity with the label applied (entity is immutable).
   */
  labelRiskFactor(effect: number | null, pValue: number | null): StatisticalAnalysis {
    const label = RiskFactorLabelVO.fromEffect(effect, pValue);
    return new StatisticalAnalysis({
      id: this.id,
      organizationId: this.organizationId,
      studyId: this.studyId,
      test: this.test,
      variableIds: this.variableIds,
      params: this.params,
      statistic: this.statistic,
      pValue: this.pValue,
      ci95: this.ci95,
      effectSize: this.effectSize,
      n: this.n,
      riskLabel: this.pValue === null ? null : label.value,
      executedAt: this.executedAt,
    });
  }
}