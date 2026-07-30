// apps/web/src/components/research/ForestPlot.tsx
// Forest plot (M4) for OR/HR with 95% CI whiskers. Renders a custom SVG: each
// row is a study/variable with a point at the effect estimate and whiskers for
// the CI; a vertical reference line is drawn at the null-effect value (1.0 for
// OR/HR, 0 for continuous). Gated by RESEARCH_V3_VIZ.

'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { ChartFooter } from './ChartFooter';
import { ExportChartButton } from './ExportChartButton';

export interface ForestRow {
  label: string;
  /** point estimate (OR/HR/β) */
  estimate: number;
  /** 95% CI bounds */
  ciLower: number;
  ciUpper: number;
  /** weight (relative box size); optional */
  weight?: number;
}

export interface ForestPlotProps {
  rows: ForestRow[];
  /** null-effect reference value: 1 for OR/HR, 0 for Risk Difference/β */
  nullEffect?: number;
  /** effect label, e.g. "Odds Ratio (95% CI)" */
  effectLabel?: string;
  height?: number;
}

function fmt(n: number): string { return Number.isInteger(n) ? String(n) : n.toFixed(2); }

export function ForestPlot({ rows, nullEffect = 1, effectLabel = 'Effect (95% CI)', height }: ForestPlotProps) {
  const enabled = useFeatureFlag('RESEARCH_V3_VIZ');
  if (!enabled) {
    return <p className="text-xs text-on-surface-variant">Visualizaciones V3 deshabilitadas (RESEARCH_V3_VIZ).</p>;
  }
  if (rows.length === 0) {
    return <p className="text-xs text-on-surface-variant">Sin datos para el forest plot.</p>;
  }

  const W = 520;
  const rowH = 28;
  const H = height ?? Math.max(120, rows.length * rowH + 40);
  const plotL = 140;   // label column width
  const plotR = 16;
  const plotT = 16;
  const plotB = 28;
  const plotW = W - plotL - plotR;
  const plotH = H - plotT - plotB;

  const allValues = rows.flatMap((r) => [r.estimate, r.ciLower, r.ciUpper, nullEffect]);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  // pad the range slightly
  const padMin = min - range * 0.05;
  const padMax = max + range * 0.05;
  const padRange = padMax - padMin || 1;
  const sx = (x: number) => plotL + ((x - padMin) / padRange) * plotW;
  const rowY = (i: number) => plotT + i * rowH + rowH / 2;
  const maxWeight = Math.max(...rows.map((r) => r.weight ?? 1));

  return (
    <div data-testid="forest-plot">
      <svg width={W} height={H} role="img" aria-label="Forest plot">
        {/* null-effect vertical reference */}
        <line x1={sx(nullEffect)} y1={plotT} x2={sx(nullEffect)} y2={plotT + plotH} stroke="#9ca3af" strokeDasharray="4 3" />
        {/* axis */}
        <line x1={plotL} y1={plotT + plotH} x2={plotL + plotW} y2={plotT + plotH} stroke="#374151" />
        {/* rows */}
        {rows.map((r, i) => {
          const y = rowY(i);
          const box = 4 + ((r.weight ?? 1) / maxWeight) * 10;
          const inRange = r.ciLower >= padMin && r.ciUpper <= padMax;
          return (
            <g key={i}>
              <text x={plotL - 8} y={y + 3} textAnchor="end" fontSize={11} fill="#374151">{r.label}</text>
              {/* whisker (clamped to range) */}
              <line
                x1={sx(Math.max(r.ciLower, padMin))}
                y1={y} x2={sx(Math.min(r.ciUpper, padMax))} y2={y}
                stroke="#0ea5e9" strokeWidth={1.5}
              />
              {!inRange && r.ciLower < padMin && <text x={plotL} y={y + 3} fontSize={10} fill="#9ca3af">‹</text>}
              {!inRange && r.ciUpper > padMax && <text x={plotL + plotW} y={y + 3} fontSize={10} fill="#9ca3af">›</text>}
              {/* whisker caps */}
              <line x1={sx(Math.max(r.ciLower, padMin))} y1={y - 4} x2={sx(Math.max(r.ciLower, padMin))} y2={y + 4} stroke="#0ea5e9" strokeWidth={1.5} />
              <line x1={sx(Math.min(r.ciUpper, padMax))} y1={y - 4} x2={sx(Math.min(r.ciUpper, padMax))} y2={y + 4} stroke="#0ea5e9" strokeWidth={1.5} />
              {/* estimate point */}
              <rect x={sx(r.estimate) - box / 2} y={y - box / 2} width={box} height={box} fill="#4f46e5" />
              {/* text annotation */}
              <text x={plotL + plotW + 6} y={y + 3} textAnchor="start" fontSize={10} fill="#6b7280">
                {fmt(r.estimate)} [{fmt(r.ciLower)}, {fmt(r.ciUpper)}]
              </text>
            </g>
          );
        })}
        {/* x-axis ticks */}
        <text x={plotL} y={H - 8} fontSize={10} fill="#6b7280">{fmt(padMin)}</text>
        <text x={plotL + plotW} y={H - 8} textAnchor="end" fontSize={10} fill="#6b7280">{fmt(padMax)}</text>
        <text x={plotL + plotW / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="#374151">{effectLabel}</text>
      </svg>
      <div className="flex items-center justify-between">
        <ChartFooter n={rows.length} test="Forest" />
        <ExportChartButton fileName="forest-plot" selector="forest-plot" />
      </div>
    </div>
  );
}

export default ForestPlot;