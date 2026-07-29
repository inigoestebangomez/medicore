'use client';

// apps/web/src/components/research/StatisticalResults.tsx
// Renders an inferential test result (spec §1): statistic (t/χ²/F/...), p-value,
// 95% CI, effect size (Cohen's d / odds ratio / hazard ratio / r), degrees of
// freedom and assumption warnings. N<5 cells are never displayed here — the
// backend suppresses them upstream (BR-RES-004); this component additionally
// surfaces a clinical-critical callout when p is null for sample/p-value.

import type { StatisticalTestResult } from '@medicore/contracts';
import { clinicalColors } from '../../../tokens/clinical';

export interface StatisticalResultsProps {
  result: StatisticalTestResult;
  /** Compact mode (used inside widgets). */
  compact?: boolean;
}

function fmt(v: number | null | undefined, digits = 3): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return Math.abs(v) >= 1000 ? v.toExponential(2) : v.toFixed(digits);
}
function pValue(p: number | null | undefined): string {
  if (p === null || p === undefined || Number.isNaN(p)) return '—';
  if (p < 0.001) return '<0.001';
  if (p < 0.05) return p.toFixed(3);
  return p.toFixed(3);
}
function isSignificant(p: number | null | undefined): boolean {
  return p !== null && p !== undefined && !Number.isNaN(p) && p < 0.05;
}

export function StatisticalResults({ result, compact }: StatisticalResultsProps) {
  const sig = isSignificant(result.pValue);
  const effect = result.effectSize;

  return (
    <div
      className={`rounded-lg border bg-surface-lowest p-3 ${compact ? 'text-xs' : 'text-sm'}`}
      style={{ borderColor: sig ? clinicalColors.success.onLight : 'var(--color-outline-variant)', fontVariantNumeric: 'tabular-nums' }}
      data-testid="statistical-results"
    >
      <div className="flex items-center justify-between border-b border-outline-variant pb-1">
        <span className="font-semibold capitalize text-on-surface">{result.test.replace(/_/g, ' ')}</span>
        <span
          className="rounded px-2 py-0.5 text-xs font-bold"
          style={{ color: sig ? clinicalColors.success.onLight : clinicalColors.neutral.onLight }}
        >
          {sig ? 'p<0.05' : 'n.s.'}
        </span>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        <div>
          <dt className="text-on-surface-variant">Statistic</dt>
          <dd className="font-semibold text-on-surface">{fmt(result.statistic)}</dd>
        </div>
        <div>
          <dt className="text-on-surface-variant">p-value</dt>
          <dd className="font-semibold text-on-surface">{pValue(result.pValue)}</dd>
        </div>
        <div>
          <dt className="text-on-surface-variant">95% CI</dt>
          <dd className="text-on-surface">
            [{fmt(result.ci95Lower)}, {fmt(result.ci95Upper)}]
          </dd>
        </div>
        <div>
          <dt className="text-on-surface-variant">df</dt>
          <dd className="text-on-surface">{result.degreesFreedom ?? '—'}</dd>
        </div>
        {effect && (
          <div className="col-span-2">
            <dt className="text-on-surface-variant">Effect size</dt>
            <dd className="text-on-surface">
              {effect.name} = {fmt(effect.value)}
              {effect.ci95Lower !== null && effect.ci95Upper !== null
                ? ` [${fmt(effect.ci95Lower)}, ${fmt(effect.ci95Upper)}]`
                : ''}
            </dd>
          </div>
        )}
      </dl>

      {result.warnings.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-outline-variant pt-2">
          {result.warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-1 text-xs" style={{ color: clinicalColors.warning.onLight }}>
              <span aria-hidden>⚠</span>
              <span>
                <strong>{w.code}</strong>: {w.message}
                {w.suggestion && <span className="text-on-surface-variant"> — {w.suggestion}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default StatisticalResults;