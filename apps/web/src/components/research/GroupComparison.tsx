// apps/web/src/components/research/GroupComparison.tsx
// Group comparison view (M6). Group A/B definition via two filter sets (group
// selector + variable multi-select), triggers POST /research/analysis/compare-groups
// and renders the comparison table with auto-selected test name and formatted
// p-values. Gated by RESEARCH_V3_VIZ.

'use client';

import { useState } from 'react';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useGroupComparison, type GroupComparisonResult } from '@/hooks/useStudiesWithBadges';

const DEFAULT_VARIABLES = ['age', 'sex', 'smoker', 'followUpMonths', 'event'];

export interface GroupComparisonProps {
  studyId: string;
  /** variable field choices */
  variableOptions?: string[];
}

export function GroupComparison({ studyId, variableOptions = DEFAULT_VARIABLES }: GroupComparisonProps) {
  const enabled = useFeatureFlag('RESEARCH_V3_VIZ');
  const [groupBy, setGroupBy] = useState('sex');
  const [variables, setVariables] = useState<string[]>(['age', 'smoker']);
  const mutation = useGroupComparison();
  const result = (mutation.data ?? null) as GroupComparisonResult | null;

  if (!enabled) {
    return <p className="text-xs text-on-surface-variant">Comparación de grupos V3 deshabilitada (RESEARCH_V3_VIZ).</p>;
  }

  async function run() {
    await mutation.mutateAsync({ studyId, groupBy, variableFields: variables });
  }

  function toggleVar(v: string) {
    setVariables((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  return (
    <div data-testid="group-comparison" className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-xs font-semibold uppercase text-on-surface-variant">
          Agrupar por
          <input
            list="gc-variable-options"
            aria-label="Agrupar por"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="mt-1 w-full rounded border border-outline px-2 py-1 text-sm"
          />
          <datalist id="gc-variable-options">
            {variableOptions.map((v) => <option key={v} value={v} />)}
          </datalist>
        </label>
        <div className="text-xs font-semibold uppercase text-on-surface-variant">
          Variables a comparar
          <div className="mt-1 flex flex-wrap gap-3">
            {variableOptions.map((v) => (
              <label key={v} className="inline-flex items-center gap-1 text-xs font-normal">
                <input
                  type="checkbox"
                  checked={variables.includes(v)}
                  onChange={() => toggleVar(v)}
                  aria-label={`variable ${v}`}
                />
                {v}
              </label>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void run()}
        disabled={mutation.isPending || variables.length === 0}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary disabled:opacity-50"
      >
        {mutation.isPending ? 'Comparando…' : 'Comparar grupos'}
      </button>

      {result && <ComparisonTable result={result} />}
      {mutation.isError && <p className="text-xs text-red-600">Error al comparar grupos.</p>}
    </div>
  );
}

const TEST_LABEL: Record<string, string> = {
  ttest_independent: 't de Student',
  mannwhitney: 'Mann-Whitney',
  chi_square: 'χ²',
  fisher_exact: 'Fisher',
};

function ComparisonTable({ result }: { result: GroupComparisonResult }) {
  return (
    <div className="overflow-x-auto rounded-md border border-outline-variant" data-testid="comparison-table">
      <table className="min-w-full text-sm">
        <thead className="bg-surface-low text-on-surface-variant">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Variable</th>
            <th className="px-3 py-2 text-left font-medium">Test</th>
            {result.groups.map((g) => (
              <th key={g} className="px-3 py-2 text-left font-medium">{g}</th>
            ))}
            <th className="px-3 py-2 text-left font-medium">p</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {result.variables.map((v) => (
            <tr key={v.field}>
              <td className="px-3 py-2 font-medium text-on-surface">{v.field}</td>
              <td className="px-3 py-2 text-on-surface-variant">{v.test ? TEST_LABEL[v.test] ?? v.test : '—'}</td>
              {v.groups.map((g) => (
                <td key={g.key} className="px-3 py-2 text-on-surface-variant" data-testid={`cell-${v.field}-${g.key}`}>
                  {describe(g)}
                </td>
              ))}
              <td className="px-3 py-2 font-semibold text-on-surface" data-testid={`p-${v.field}`}>{v.pValue}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {result.warnings.length > 0 && (
        <p className="bg-surface-low px-3 py-1.5 text-xs text-on-surface-variant">
          {result.warnings.join(' · ')}
        </p>
      )}
    </div>
  );
}

function describe(g: GroupComparisonResult['variables'][number]['groups'][number]): string {
  if (g.representation === 'categorical') {
    return g.categories.map((c) => `${c.label}: ${c.count} (${c.percent}%)`).join(', ');
  }
  if (g.representation === 'mean_sd') {
    return `${fmt(g.mean)} ± ${fmt(g.sd)} (n=${g.n})`;
  }
  return `${fmt(g.median)} [${fmt(g.q1)}-${fmt(g.q3)}] (n=${g.n})`;
}

function fmt(n: number | null): string { return n === null ? '—' : (Number.isInteger(n) ? String(n) : n.toFixed(2)); }

export default GroupComparison;