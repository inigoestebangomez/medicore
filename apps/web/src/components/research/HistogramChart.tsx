// apps/web/src/components/research/HistogramChart.tsx
// Histogram with normal-density overlay (M4). Bins the input series client-side
// into `bins` buckets (default 10), renders a Recharts BarChart, and overlays
// the theoretical normal density curve (mean ± SD) as a Line. Exports at 300dpi
// via ExportChartButton. Gated by RESEARCH_V3_VIZ — falls back to a hint when off.

'use client';

import { useMemo } from 'react';
import {
  Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { ChartFooter } from './ChartFooter';
import { ExportChartButton } from './ExportChartButton';

export interface HistogramChartProps {
  field: string;
  values: number[];
  bins?: number;
  /** optional test name + alpha for the footer (BR-RES-007) */
  test?: string | null;
  alpha?: number;
  height?: number;
}

function mean(v: number[]): number { return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; }
function stddev(v: number[]): number {
  if (v.length < 2) return 0;
  const m = mean(v);
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
}
// Normal PDF
function normalPdf(x: number, mu: number, sigma: number): number {
  if (sigma <= 0) return 0;
  return (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma));
}

export function HistogramChart({ field, values, bins = 10, test, alpha = 0.05, height = 280 }: HistogramChartProps) {
  const enabled = useFeatureFlag('RESEARCH_V3_VIZ');
  const { data, mu, sigma } = useMemo(() => {
    if (values.length === 0) return { data: [], mu: 0, sigma: 0 };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const bw = range / bins;
    const counts = new Array(bins).fill(0);
    for (const v of values) {
      let idx = Math.floor((v - min) / bw);
      if (idx >= bins) idx = bins - 1;
      if (idx < 0) idx = 0;
      counts[idx]++;
    }
    const m = mean(values);
    const s = stddev(values);
    const data = counts.map((count, i) => {
      const x = min + bw * (i + 0.5);
      // scale the density to the count axis so the overlay is visible
      const expected = normalPdf(x, m, s) * values.length * bw;
      return { bin: Number(x.toFixed(3)), count, density: Number(expected.toFixed(3)) };
    });
    return { data, mu: m, sigma: s };
  }, [values, bins]);

  if (!enabled) {
    return <p className="text-xs text-on-surface-variant">Visualizaciones V3 deshabilitadas (RESEARCH_V3_VIZ).</p>;
  }
  if (values.length < 5) {
    return <p className="text-xs text-amber-700">Muestra insuficiente (N&lt;5) — histograma oculto (BR-RES-004).</p>;
  }

  return (
    <div data-testid="histogram-chart">
      <div className="h-72 w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="bin" tick={{ fontSize: 11 }} label={{ value: field, position: 'insideBottom', offset: -2, fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#6366f1" name="Frecuencia" />
            <Line type="monotone" dataKey="density" stroke="#ef4444" strokeWidth={2} dot={false} name="Densidad normal" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-between">
        <ChartFooter n={values.length} test={test} alpha={alpha} note={`μ=${mu.toFixed(2)}, σ=${sigma.toFixed(2)}`} />
        <ExportChartButton fileName={`histogram-${field}`} selector="histogram-chart" />
      </div>
    </div>
  );
}

export default HistogramChart;