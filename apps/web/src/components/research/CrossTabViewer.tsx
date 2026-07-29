'use client';

// apps/web/src/components/research/CrossTabViewer.tsx
// Contingency-table heatmap (spec §2, BR-RES-004). Renders the cross-tab as a
// color-shaded table; cells with count < 5 (or server-flagged suppression) are
// rendered as "<5" and excluded from the heat scale. Footer shows the
// chi-square / Fisher p-value and odds ratio with 95% CI.

import { useCrossTab } from '@/hooks/useResearchV2';
import { clinicalColors } from '../../../tokens/clinical';
import type { CSSProperties } from 'react';

export interface CrossTabViewerProps {
  rowField: string;
  colField: string;
  queryId?: string;
  dataSource?: string;
  compact?: boolean;
}

const SUPP = 5; // BR-RES-004

/** Heat scale: 0 → light, max → strong clinical-info. */
function heatStyle(count: number, max: number): CSSProperties {
  if (max <= 0) return {};
  const t = Math.min(1, count / max);
  // Interpolate white → info-blue.
  const alpha = 0.08 + t * 0.55;
  return { backgroundColor: `rgba(3, 105, 161, ${alpha.toFixed(3)})` };
}

export function CrossTabViewer({ rowField, colField, queryId, dataSource, compact }: CrossTabViewerProps) {
  const { data, isLoading, isError } = useCrossTab(rowField, colField, queryId, dataSource, !!rowField && !!colField);

  if (isLoading) return <p className="text-sm text-on-surface-variant">Calculando cross-tab…</p>;
  if (isError) return <p className="text-sm text-red-600">Error al calcular la tabla de contingencia.</p>;
  if (!data) return null;

  const max = data.cells.flat().reduce((m, c) => (c.suppressed ? m : Math.max(m, c.count)), 0);

  const fmtP = (p: number | null): string => {
    if (p === null || Number.isNaN(p)) return '—';
    return p < 0.001 ? '<0.001' : p.toFixed(3);
  };

  return (
    <div className={`overflow-x-auto ${compact ? 'text-xs' : 'text-sm'}`} data-testid="cross-tab-viewer">
      <table className="border-collapse" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr>
            <th className="border border-outline-variant bg-surface-low p-1 text-left text-on-surface-variant">
              {rowField}
            </th>
            {data.cols.map((c) => (
              <th key={c} className="border border-outline-variant bg-surface-low p-1 text-right text-on-surface">
                {c}
              </th>
            ))}
            <th className="border border-outline-variant bg-surface-low p-1 text-right font-semibold text-on-surface">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r, ri) => (
            <tr key={r}>
              <td className="border border-outline-variant bg-surface-low p-1 text-left text-on-surface">{r}</td>
              {data.cols.map((_, ci) => {
                const cell = data.cells[ri]?.[ci];
                if (!cell) return <td key={ci} className="border border-outline-variant p-1 text-right">—</td>;
                if (cell.suppressed || cell.count < SUPP) {
                  return (
                    <td key={ci} className="border border-outline-variant p-1 text-right text-on-surface-variant/50">
                      &lt;{SUPP}
                    </td>
                  );
                }
                return (
                  <td
                    key={ci}
                    className="border border-outline-variant p-1 text-right"
                    style={heatStyle(cell.count, max)}
                    title={`${cell.count}`}
                  >
                    {cell.count}
                  </td>
                );
              })}
              <td className="border border-outline-variant bg-surface-low p-1 text-right font-semibold text-on-surface">
                {data.rowTotals[ri] ?? 0}
              </td>
            </tr>
          ))}
          <tr>
            <td className="border border-outline-variant bg-surface-low p-1 text-left font-semibold text-on-surface">Total</td>
            {data.colTotals.map((t, ci) => (
              <td key={ci} className="border border-outline-variant bg-surface-low p-1 text-right font-semibold text-on-surface">
                {t}
              </td>
            ))}
            <td className="border border-outline-variant bg-surface-low p-1 text-right font-bold text-on-surface">
              {data.grandTotal}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={data.cols.length + 2} className="p-1 text-xs text-on-surface-variant">
              <span className="mr-3">χ² p = <strong>{fmtP(data.chiSquareP)}</strong></span>
              {data.fisherExactP !== null && (
                <span className="mr-3">Fisher p = <strong>{fmtP(data.fisherExactP)}</strong></span>
              )}
              {data.oddsRatio !== null && (
                <span>
                  OR = <strong>{data.oddsRatio.toFixed(2)}</strong>
                  {data.oddsRatioCi95
                    ? ` [${data.oddsRatioCi95[0].toFixed(2)}, ${data.oddsRatioCi95[1].toFixed(2)}]`
                    : ''}
                </span>
              )}
            </td>
          </tr>
          {data.warnings.length > 0 && (
            <tr>
              <td colSpan={data.cols.length + 2} className="p-1 text-xs" style={{ color: clinicalColors.warning.onLight }}>
                ⚠ {data.warnings.join('; ')}
              </td>
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  );
}

export default CrossTabViewer;