// apps/web/src/components/research/BlandAltmanPlot.tsx
// Bland-Altman plot (M4) for pre/post concordance. Renders a custom SVG scatter
// of (mean, diff) pairs with the bias line (mean of differences) and the 95%
// limits of agreement (mean ± 1.96 × SD of differences). Gated by RESEARCH_V3_VIZ.
//
// Used to assess agreement between two measurements (e.g. pre vs post, or two
// raters) — spec BR-RES-007 footer injected.

'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { ChartFooter } from './ChartFooter';
import { ExportChartButton } from './ExportChartButton';

export interface BlandAltmanPair {
  /** mean of the two measurements */
  mean: number;
  /** difference (m1 - m2) */
  diff: number;
}

export interface BlandAltmanPlotProps {
  pairs: BlandAltmanPair[];
  /** measurement label */
  label?: string;
  height?: number;
}

function mean(v: number[]): number { return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; }
function stddev(v: number[]): number {
  if (v.length < 2) return 0;
  const m = mean(v);
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
}
function fmt(n: number): string { return Number.isInteger(n) ? String(n) : n.toFixed(2); }

export function BlandAltmanPlot({ pairs, label = 'Medición', height = 280 }: BlandAltmanPlotProps) {
  const enabled = useFeatureFlag('RESEARCH_V3_VIZ');
  if (!enabled) {
    return <p className="text-xs text-on-surface-variant">Visualizaciones V3 deshabilitadas (RESEARCH_V3_VIZ).</p>;
  }
  if (pairs.length < 5) {
    return <p className="text-xs text-amber-700">Muestra insuficiente (N&lt;5) — BR-RES-004.</p>;
  }

  const diffs = pairs.map((p) => p.diff);
  const bias = mean(diffs);
  const sd = stddev(diffs);
  const loaUpper = bias + 1.96 * sd;
  const loaLower = bias - 1.96 * sd;

  const xs = pairs.map((p) => p.mean);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...diffs, loaLower);
  const yMax = Math.max(...diffs, loaUpper);

  const W = 480;
  const H = height;
  const padL = 48;
  const padR = 16;
  const padT = 12;
  const padB = 32;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const sx = (x: number) => padL + ((x - xMin) / xRange) * plotW;
  const sy = (y: number) => padT + plotH - ((y - yMin) / yRange) * plotH;

  return (
    <div data-testid="bland-altman-plot">
      <svg width={W} height={H} role="img" aria-label="Bland-Altman">
        {/* axes */}
        <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#9ca3af" />
        <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#9ca3af" />
        {/* zero/bias reference lines */}
        <line x1={padL} y1={sy(bias)} x2={padL + plotW} y2={sy(bias)} stroke="#4f46e5" strokeWidth={1.5} />
        <line x1={padL} y1={sy(loaUpper)} x2={padL + plotW} y2={sy(loaUpper)} stroke="#ef4444" strokeDasharray="4 3" />
        <line x1={padL} y1={sy(loaLower)} x2={padL + plotW} y2={sy(loaLower)} stroke="#ef4444" strokeDasharray="4 3" />
        <line x1={padL} y1={sy(0)} x2={padL + plotW} y2={sy(0)} stroke="#d1d5db" strokeDasharray="2 2" />
        {/* scatter */}
        {pairs.map((p, i) => (
          <circle key={i} cx={sx(p.mean)} cy={sy(p.diff)} r={3} fill="#0ea5e9" fillOpacity={0.7} />
        ))}
        {/* labels */}
        <text x={W / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="#374151">Media de medidas ({label})</text>
        <text x={10} y={H / 2} textAnchor="middle" fontSize={11} fill="#374151" transform={`rotate(-90 10 ${H / 2})`}>Diferencia</text>
        <text x={W - padR} y={sy(bias) - 4} textAnchor="end" fontSize={10} fill="#4f46e5">Bias {fmt(bias)}</text>
        <text x={W - padR} y={sy(loaUpper) - 4} textAnchor="end" fontSize={10} fill="#ef4444">+1.96SD {fmt(loaUpper)}</text>
        <text x={W - padR} y={sy(loaLower) + 12} textAnchor="end" fontSize={10} fill="#ef4444">-1.96SD {fmt(loaLower)}</text>
      </svg>
      <div className="flex items-center justify-between">
        <ChartFooter n={pairs.length} test="Bland-Altman" />
        <ExportChartButton fileName="bland-altman" selector="bland-altman-plot" />
      </div>
    </div>
  );
}

export default BlandAltmanPlot;