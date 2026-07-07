// apps/web/src/features/scales/components/score-evolution-chart.tsx
// BR-SCA-003: Chronological ordering for evolution view
// Uses Recharts to render score evolution over time for scales of the same type.

'use client';

import { useScales } from '../hooks/useScales';
import type { ClinicalScaleType } from '@medicore/contracts';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';

const SCALE_LABELS: Record<string, string> = {
  SNOT_22: 'SNOT-22',
  VAS_TINNITUS: 'VAS Tinnitus',
  DHI: 'DHI',
  VHI: 'VHI',
  RSI: 'RSI',
  OSA_EPWORTH: 'Epworth',
  STOPBANG: 'STOP-BANG',
  NOSE: 'NOSE',
  CUSTOM: 'Custom',
};

interface ScoreEvolutionChartProps {
  patientId: string;
  scaleType: ClinicalScaleType;
  from?: string;
  to?: string;
}

interface ChartDatum {
  date: string;
  label: string;
  total: number;
  notes: string | null;
}

function formatTooltipDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatAxisDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function ScoreEvolutionChart({ patientId, scaleType, from, to }: ScoreEvolutionChartProps) {
  const { data, isLoading, error } = useScales(patientId, {
    scaleType,
    from,
    to,
    page: 1,
    pageSize: 100,
  });

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading scale history...</div>;
  }

  if (error) {
    return <div className="p-4 text-sm text-destructive">Error: {error.message}</div>;
  }

  const items = data?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No {SCALE_LABELS[scaleType] ?? scaleType} scales recorded yet.
      </div>
    );
  }

  // Items are returned date-descending by the API (BR-SCA-003).
  // Reverse to chronological ascending for the chart X-axis (oldest → newest).
  const chartData: ChartDatum[] = [...items]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((scale) => ({
      date: scale.date,
      label: formatAxisDate(scale.date),
      total: scale.total,
      notes: scale.notes,
    }));

  const maxTotal = Math.max(...chartData.map((d) => d.total), 0);

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">
        {SCALE_LABELS[scaleType] ?? scaleType} — Evolution
      </h4>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border, #e5e7eb))" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground, #6b7280))"
            />
            <YAxis
              allowDecimals={false}
              domain={[0, maxTotal > 0 ? maxTotal : 'auto']}
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground, #6b7280))"
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const datum = payload[0].payload as ChartDatum;
                return (
                  <div className="rounded bg-popover px-2 py-1 text-xs text-popover-foreground shadow">
                    <p className="font-medium">{formatTooltipDate(datum.date)}</p>
                    <p>Total: {datum.total}</p>
                    {datum.notes && <p className="max-w-xs truncate">Notes: {datum.notes}</p>}
                  </div>
                );
              }}
            />
            <Legend />
            <ReferenceLine y={0} stroke="transparent" />
            <Line
              type="monotone"
              dataKey="total"
              name="Total score"
              stroke="hsl(var(--primary, #2563eb))"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-2 py-1 text-left text-xs font-medium text-muted-foreground">Date</th>
              <th className="px-2 py-1 text-right text-xs font-medium text-muted-foreground">Total</th>
              <th className="px-2 py-1 text-left text-xs font-medium text-muted-foreground">Notes</th>
            </tr>
          </thead>
          <tbody>
            {items.map((scale) => (
              <tr key={scale.id} className="border-b hover:bg-muted/50">
                <td className="px-2 py-1">
                  {new Date(scale.date).toLocaleDateString()}
                </td>
                <td className="px-2 py-1 text-right font-medium">{scale.total}</td>
                <td className="px-2 py-1 text-muted-foreground">{scale.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}