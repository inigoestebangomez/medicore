'use client';

// apps/web/src/components/research/TimeSeriesChart.tsx
// Temporal-trend chart (spec §3). Recharts line/area over event counts grouped
// by period (month/quarter/year). Empty periods render as zero (service fills
// them) so the axis never breaks. A trend annotation (slope) is shown when the
// server computes one.

import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { TimeSeriesPeriod } from '@medicore/contracts';
import { useTimeSeries } from '@/hooks/useResearchV2';

export interface TimeSeriesChartProps {
  metric: string;
  period?: TimeSeriesPeriod;
  queryId?: string;
  dateField?: string;
  height?: number;
}

export function TimeSeriesChart({
  metric, period = 'month', queryId, dateField, height = 280,
}: TimeSeriesChartProps) {
  const { data, isLoading, isError } = useTimeSeries(metric, period, queryId, dateField, !!metric);

  if (isLoading) return <p className="text-sm text-on-surface-variant">Calculando serie temporal…</p>;
  if (isError) return <p className="text-sm text-red-600">Error al calcular la serie temporal.</p>;
  if (!data) return null;

  const chartData = data.points.map((p) => ({ period: p.period, count: p.count }));
  const trend = data.trendSlope !== null && data.trendSlope !== undefined;
  const avg = chartData.length
    ? chartData.reduce((s, p) => s + p.count, 0) / chartData.length
    : 0;

  return (
    <div data-testid="time-series-chart">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <defs>
            <linearGradient id="tsArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          <Area type="monotone" dataKey="count" stroke="none" fill="url(#tsArea)" />
          <Line type="monotone" dataKey="count" stroke="#0369A1" strokeWidth={2} dot={false} />
          {trend && (
            <ReferenceLine y={avg} stroke="#15803D" strokeDasharray="4 4" label={{ value: 'trend', fontSize: 10, position: 'insideTopRight' }} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-1 text-xs text-on-surface-variant" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {data.metric} · {data.period}
        {trend ? ` · pendiente ${data.trendSlope!.toFixed(3)}` : ''}
      </p>
    </div>
  );
}

export default TimeSeriesChart;