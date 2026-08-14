'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

export interface MonthlyPoint {
  month: string;
  total: number;
}

interface TrendChartProps {
  data: MonthlyPoint[];
}

function formatEUR(value: number): string {
  return value.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded border border-outline-variant bg-surface-lowest px-3 py-2 text-xs shadow-card">
      <p className="font-medium text-on-surface">{label}</p>
      <p className="text-on-surface-variant">{formatEUR(payload[0].value)}</p>
    </div>
  );
}

/** Lightweight monthly billing trend chart. */
export function TrendChart({ data }: TrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-on-surface-variant/60">
        Sin datos mensuales
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <defs>
            <linearGradient id="billingTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#6b7280" />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="#6b7280"
            tickFormatter={(v) => formatEUR(Number(v))}
            width={70}
          />
          <Tooltip content={<TrendTooltip />} />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#22d3ee"
            strokeWidth={2}
            fill="url(#billingTrendFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}