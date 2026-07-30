// apps/web/src/components/research/PieDonutChart.tsx
// Pie/donut chart with auto-fallback to a bar chart when there are more than 5
// categories (BR-RES-007: pie charts become unreadable beyond ~5 slices).
// Gated by RESEARCH_V3_VIZ.

'use client';

import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { ChartFooter } from './ChartFooter';
import { ExportChartButton } from './ExportChartButton';

export interface PieCategory {
  label: string;
  count: number;
}

export interface PieDonutChartProps {
  field: string;
  categories: PieCategory[];
  /** pie slice colors */
  colors?: string[];
  height?: number;
}

const DEFAULT_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const MAX_SLICES = 5;

export function PieDonutChart({ field, categories, colors = DEFAULT_COLORS, height = 280 }: PieDonutChartProps) {
  const enabled = useFeatureFlag('RESEARCH_V3_VIZ');
  if (!enabled) {
    return <p className="text-xs text-on-surface-variant">Visualizaciones V3 deshabilitadas (RESEARCH_V3_VIZ).</p>;
  }

  const total = categories.reduce((a, c) => a + c.count, 0);
  if (total < 5) {
    return <p className="text-xs text-amber-700">Muestra insuficiente (N&lt;5) — BR-RES-004.</p>;
  }

  const overLimit = categories.length > MAX_SLICES;
  const top = overLimit
    ? [...categories].sort((a, b) => b.count - a.count).slice(0, MAX_SLICES)
    : categories;
  const testDataTestId = overLimit ? 'pie-fallback-bar' : 'pie-chart';

  return (
    <div data-testid={testDataTestId}>
      {overLimit && (
        <p className="mb-1 text-xs text-amber-700" data-testid="pie-fallback-warning">
          &gt;{MAX_SLICES} categorías — sustituyendo por gráfico de barras (BR-RES-007).
        </p>
      )}
      <div className="h-72 w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {overLimit ? (
            <BarChart data={top}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#4f46e5" />
            </BarChart>
          ) : (
            <PieChart>
              <Pie data={top} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={90} label={(e: any) => `${e.name}: ${e.value}`}>
                {top.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-between">
        <ChartFooter n={total} test={overLimit ? 'bar fallback' : null} />
        <ExportChartButton fileName={`pie-${field}`} selector={testDataTestId} />
      </div>
    </div>
  );
}

export default PieDonutChart;