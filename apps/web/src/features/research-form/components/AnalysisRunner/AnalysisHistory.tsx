'use client';

// apps/web/src/features/research-form/components/AnalysisRunner/AnalysisHistory.tsx
// AnalysisHistory (REQ-FB-012): traceable list of every executed analysis —
// variables, test, statistic, IC95%, N and risk/protective label — the
// future AI article-generation "raw material".

import type { StatisticalAnalysisResponse } from '@medicore/contracts';
import { RiskFactorBadge } from './RiskFactorBadge';

export function AnalysisHistory({ items }: { items: StatisticalAnalysisResponse[] }) {
  if (items.length === 0) return <p className="text-sm text-on-surface-variant">Aún no se ha ejecutado ningún análisis.</p>;
  return (
    <ul className="space-y-2">
      {items.map((a) => {
        const effect = a.effectSize?.or ?? a.effectSize?.hr ?? a.effectSize?.value ?? null;
        return (
          <li key={a.id} className="rounded border border-outline bg-surface p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-on-surface">{a.test}</span>
              <RiskFactorBadge label={a.riskLabel} />
              <span className="text-xs text-on-surface-variant">N = {a.n}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-4 text-xs text-on-surface-variant">
              <span>Estadístico: {fmt(a.statistic)}</span>
              <span>p = {fmt(a.pValue)}</span>
              {a.ci95 && <span>IC95%: [{fmt(a.ci95.lower)}, {fmt(a.ci95.upper)}]</span>}
              {effect != null && <span>Efecto: {fmt(effect)}</span>}
            </div>
            <span className="text-xs text-on-surface-variant">
              {new Date(a.executedAt).toLocaleString()} · {a.variableIds.length} variables
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function fmt(n: number | null): string {
  if (n === null || !isFinite(n)) return '—';
  return Math.abs(n) < 0.001 || Math.abs(n) >= 1e6 ? n.toExponential(2) : n.toFixed(4);
}

export default AnalysisHistory;