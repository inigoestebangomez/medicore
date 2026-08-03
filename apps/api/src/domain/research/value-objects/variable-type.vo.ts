// apps/api/src/domain/research/value-objects/variable-type.vo.ts
// Value object: VariableType — closed enum of the six analysis-oriented
// variable kinds (REQ-FB-001, doc 07 §3). Each type carries the set of
// statistical tests it is compatible with (REQ-FB-010 decision tree).

import type { AnalysisTest } from '@medicore/contracts';

const VARIABLE_TYPES = [
  'CONTINUOUS',
  'DISCRETE',
  'DICHOTOMOUS',
  'NOMINAL',
  'ORDINAL',
  'TIME_TO_EVENT',
] as const;

export type VariableTypeLiteral = (typeof VARIABLE_TYPES)[number];

/** Map of variable type → tests it can participate in (REQ-FB-010 §4.5). */
const COMPATIBLE_TESTS: Record<VariableTypeLiteral, AnalysisTest[]> = {
  CONTINUOUS: ['T_TEST', 'ANOVA', 'MANN_WHITNEY', 'WILCOXON', 'KRUSKAL', 'PEARSON', 'SPEARMAN', 'ICC'],
  DISCRETE: ['T_TEST', 'MANN_WHITNEY', 'WILCOXON', 'KRUSKAL', 'PEARSON', 'SPEARMAN'],
  DICHOTOMOUS: ['KAPPA', 'CHI_SQUARE', 'FISHER', 'LOGISTIC'],
  NOMINAL: ['CHI_SQUARE', 'FISHER', 'KAPPA'],
  ORDINAL: ['MANN_WHITNEY', 'WILCOXON', 'KRUSKAL', 'SPEARMAN', 'CHI_SQUARE'],
  TIME_TO_EVENT: ['KAPLAN_MEIER', 'COX'],
};

export class VariableTypeVO {
  private constructor(public readonly value: VariableTypeLiteral) {}

  static create(value: string): VariableTypeVO {
    if (!VARIABLE_TYPES.includes(value as VariableTypeLiteral)) {
      throw new Error(`invalid_variable_type: ${value}`);
    }
    return new VariableTypeVO(value as VariableTypeLiteral);
  }

  /** Tests this variable type can participate in (REQ-FB-010). */
  get compatibleTestSet(): AnalysisTest[] {
    return COMPATIBLE_TESTS[this.value];
  }

  supports(test: AnalysisTest): boolean {
    return this.compatibleTestSet.includes(test);
  }

  /** Whether the type requires a closed options catalogue. */
  get requiresOptions(): boolean {
    return this.value === 'NOMINAL' || this.value === 'ORDINAL';
  }

  /** Whether the type carries a numeric range (min/max/step). */
  get supportsRange(): boolean {
    return this.value === 'CONTINUOUS' || this.value === 'DISCRETE';
  }

  equals(other: VariableTypeVO): boolean {
    return this.value === other.value;
  }
}