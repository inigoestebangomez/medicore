// apps/api/src/domain/research/value-objects/statistical-test.vo.ts
// Value object for an inferential statistical test result (spec §1, BR-RES-005).
// Enforces construction invariants and generates assumption warnings when the
// caller signals violated assumptions. Mirrors the Zod contract
// StatisticalTestResult, adding domain behavior (immutability + warning gen).

import type {
  InferentialTestType,
  EffectSize,
  AssumptionWarning,
} from '@medicore/contracts';

export interface StatisticalTestProps {
  test: InferentialTestType;
  statistic: number | null;
  pValue: number | null;
  ci95Lower: number | null;
  ci95Upper: number | null;
  effectSize: EffectSize;
  degreesFreedom: number | null;
  assumptionsChecked: string[];
  warnings: AssumptionWarning[];
}

export class StatisticalTestVO {
  readonly test: InferentialTestType;
  readonly statistic: number | null;
  readonly pValue: number | null;
  readonly ci95Lower: number | null;
  readonly ci95Upper: number | null;
  readonly effectSize: EffectSize;
  readonly degreesFreedom: number | null;
  readonly assumptionsChecked: string[];
  readonly warnings: AssumptionWarning[];

  private constructor(props: StatisticalTestProps) {
    this.test = props.test;
    this.statistic = props.statistic;
    this.pValue = props.pValue;
    this.ci95Lower = props.ci95Lower;
    this.ci95Upper = props.ci95Upper;
    this.effectSize = props.effectSize;
    this.degreesFreedom = props.degreesFreedom;
    this.assumptionsChecked = props.assumptionsChecked ?? [];
    this.warnings = props.warnings ?? [];
  }

  static create(props: StatisticalTestProps): StatisticalTestVO {
    // Invariant: p-value, if present, must be in [0,1]
    if (
      props.pValue !== null &&
      props.pValue !== undefined &&
      (props.pValue < 0 || props.pValue > 1)
    ) {
      throw new Error('StatisticalTest pValue must be within [0,1]');
    }
    // Invariant: CI lower <= CI upper when both present
    if (
      props.ci95Lower !== null &&
      props.ci95Upper !== null &&
      props.ci95Lower > props.ci95Upper
    ) {
      throw new Error('StatisticalTest ci95Lower must be <= ci95Upper');
    }
    return new StatisticalTestVO(props);
  }

  /** Append an assumption warning (immutable). */
  withWarning(warning: AssumptionWarning): StatisticalTestVO {
    return new StatisticalTestVO({
      ...this,
      warnings: [...this.warnings, warning],
    });
  }

  get isSignificantAt05(): boolean {
    return this.pValue !== null && this.pValue < 0.05;
  }

  toDTO() {
    return {
      test: this.test,
      statistic: this.statistic,
      pValue: this.pValue,
      ci95Lower: this.ci95Lower,
      ci95Upper: this.ci95Upper,
      effectSize: this.effectSize,
      degreesFreedom: this.degreesFreedom,
      assumptionsChecked: this.assumptionsChecked,
      warnings: this.warnings,
    };
  }
}