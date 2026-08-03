// apps/web/src/features/research-form/components/AnalysisRunner/TestDecisionTree.tsx
// TestDecisionTree (REQ-FB-010): codifies the 3-rule statistical test selection
// — (1) dependent variable type → (2) number of groups → (3) normality — and
// suggests the appropriate AnalysisTest. Pure function + a small suggestion UI.

import type { AnalysisTest, VariableType } from '@medicore/contracts';

export interface DecisionInput {
  dependentType: VariableType;
  groupCount: number;          // 0 = descriptive / correlation (no grouping)
  isNormal?: boolean | null;   // normality result for continuous dependents
  paired?: boolean;            // before/after = paired
  subjectiveOverride?: boolean;// recorded annotation — non-blocking
}

/**
 * Apply the REQ-FB-010 §4.5 decision tree. Returns null when no statistic is
 * appropriate for the combination (e.g. descriptive-only).
 */
export function suggestTest(input: DecisionInput): AnalysisTest | null {
  const { dependentType, groupCount, isNormal, paired } = input;
  // Dependent variable type branch.
  if (dependentType === 'TIME_TO_EVENT') return 'KAPLAN_MEIER';
  // Continuous branch — paramétrica / no paramétrica.
  if (dependentType === 'CONTINUOUS' || dependentType === 'DISCRETE') {
    if (groupCount <= 0) return null;
    if (groupCount === 1) return null; // descriptive only
    if (groupCount === 2) {
      if (paired) return isNormal ? 'T_TEST' : 'WILCOXON'; // paired → paired tests
      return isNormal ? 'T_TEST' : 'MANN_WHITNEY';
    }
    return isNormal ? 'ANOVA' : 'KRUSKAL';
  }
  // Categorical branch.
  if (groupCount <= 0) return null;
  if (groupCount === 2) return 'CHI_SQUARE';
  return 'CHI_SQUARE';
}

export function TestDecisionTree({
  suggestion,
  variables,
}: {
  suggestion: AnalysisTest | null;
  variables: Array<{ id: string; label: string; type: VariableType }>;
}) {
  return (
    <div className="rounded border border-outline bg-surface p-3">
      <h3 className="text-sm font-semibold text-on-surface">Árbol de decisión del test</h3>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-on-surface-variant">
        <li>Tipo de variable dependiente → continua / categórica / tiempo hasta evento.</li>
        <li>Nº de grupos: 2 → t / Mann-Whitney / Chi²; 3+ → ANOVA / Kruskal-Wallis.</li>
        <li>Normalidad: sí → paramétrica; no → no paramétrica.</li>
      </ol>
      <p className="mt-2 text-xs">
        Sugerencia sobre <strong>{variables.length}</strong> variables:{' '}
        <span className="font-semibold text-primary">{suggestion ?? 'descriptivo / sin test'}</span>
      </p>
    </div>
  );
}

export default TestDecisionTree;