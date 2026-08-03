'use client';

// apps/web/src/features/research-form/pages/studies/[id]/analyses/page.tsx
// AnalysisRunnerPage (REQ-FB-010..012): pick a test (with TestDecisionTree
// suggestion), select variables and run it; the result is persisted and
// shown in AnalysisHistory with risk/protective labels.

import { useState } from 'react';
import type { AnalysisTest, StatisticalAnalysisResponse } from '@medicore/contracts';
import { useStudyVariables, useRunAnalysis, useListAnalyses } from '@/features/research-form/api/useResearchForm';
import { TestDecisionTree } from '@/features/research-form/components/AnalysisRunner/TestDecisionTree';
import { AnalysisHistory } from '@/features/research-form/components/AnalysisRunner/AnalysisHistory';

const TESTS: AnalysisTest[] = [
  'KAPPA', 'ICC', 'CRONBACH', 'T_TEST', 'MANN_WHITNEY', 'WILCOXON', 'KRUSKAL',
  'ANOVA', 'CHI_SQUARE', 'FISHER', 'PEARSON', 'SPEARMAN', 'LOGISTIC', 'KAPLAN_MEIER', 'COX',
];

export function AnalysisRunnerPage({ studyId }: { studyId: string }) {
  const { data: variables } = useStudyVariables(studyId);
  const run = useRunAnalysis(studyId);
  const { data: history } = useListAnalyses(studyId);
  const [test, setTest] = useState<AnalysisTest>('T_TEST');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleRun = async () => {
    if (selected.size === 0) return;
    await run.mutateAsync({ test, variableIds: [...selected], params: {} });
  };

  const last: StatisticalAnalysisResponse | null = run.data ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-lg font-semibold text-on-surface">Análisis estadístico</h1>

      <TestDecisionTree suggestion={test} variables={(variables ?? []).map((v) => ({ id: v.id, label: v.label, type: v.type }))} />

      <div className="space-y-2 rounded border border-outline bg-surface p-3">
        <label className="text-sm">
          <span className="font-semibold text-on-surface">Test</span>
          <select value={test} onChange={(e) => setTest(e.target.value as AnalysisTest)} className="mt-1 w-full rounded border border-outline px-2 py-1">
            {TESTS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <fieldset className="space-y-1">
          <legend className="text-sm font-semibold text-on-surface">Variables</legend>
          {(variables ?? []).map((v) => (
            <label key={v.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggle(v.id)} />
              {v.label} <span className="text-xs text-on-surface-variant">({v.type})</span>
            </label>
          ))}
          {variables && variables.length === 0 && (
            <span className="text-xs text-on-surface-variant">Define variables en el constructor primero.</span>
          )}
        </fieldset>
        <button
          onClick={handleRun}
          disabled={selected.size === 0 || run.isPending}
          className="rounded bg-primary px-3 py-1 text-xs font-semibold text-on-primary disabled:opacity-50"
        >
          {run.isPending ? 'Ejecutando…' : 'Ejecutar análisis'}
        </button>
        {run.isError && <p className="text-xs text-error">Error: {(run.error as Error).message}</p>}
        {last && (
          <p className="rounded bg-surface-low p-2 text-xs">
            Resultado — estadístico: {last.statistic}, p: {last.pValue}, N: {last.n}, etiqueta: {last.riskLabel ?? 'neutral'}
          </p>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-on-surface">Historial</h2>
        <AnalysisHistory items={history ?? []} />
      </div>
    </div>
  );
}

export default AnalysisRunnerPage;