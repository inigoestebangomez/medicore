'use client';

import { useState, useMemo } from 'react';
import {
  useAnalyticsOverview,
  useDiagnosisDistribution,
  useScaleEvolution,
} from '@/hooks/useAnalytics';
import type {
  OverviewResponse,
  DiagnosesResponse,
} from '@/hooks/useAnalytics';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';

// ─────────────────────────────────────────────
// Period Selector
// ─────────────────────────────────────────────

type PeriodOption = '1M' | '3M' | '6M' | '1Y' | 'ALL';

const PERIODS: { value: PeriodOption; label: string }[] = [
  { value: '1M', label: 'Último mes' },
  { value: '3M', label: 'Últimos 3 meses' },
  { value: '6M', label: 'Últimos 6 meses' },
  { value: '1Y', label: 'Último año' },
  { value: 'ALL', label: 'Todo' },
];

function getPeriodDates(period: PeriodOption): {
  from: string | undefined;
  to: string | undefined;
} {
  if (period === 'ALL') return { from: undefined, to: undefined };

  const now = new Date();
  const to = now.toISOString().split('T')[0];
  let from: Date;

  switch (period) {
    case '1M':
      from = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case '3M':
      from = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case '6M':
      from = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      break;
    case '1Y':
      from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    default:
      from = now;
  }

  return { from: from.toISOString().split('T')[0], to };
}

// ─────────────────────────────────────────────
// Scale Labels
// ─────────────────────────────────────────────

const SCALE_SHORT_LABELS: Record<string, string> = {
  SNOT_22: 'SNOT-22',
  DHI: 'DHI',
};

// ─────────────────────────────────────────────
// Chart Colors
// ─────────────────────────────────────────────

const BAR_COLORS = [
  '#2563eb',
  '#3b82f6',
  '#60a5fa',
  '#93c5fd',
  '#bfdbfe',
];

const LINE_COLORS: Record<string, string> = {
  SNOT_22: '#2563eb',
  DHI: '#dc2626',
};

// ─────────────────────────────────────────────
// Shared Components
// ─────────────────────────────────────────────

function Spinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center p-8">
      <svg
        className="mr-2 h-5 w-5 animate-spin text-secondary"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <span className="text-sm text-on-surface-variant">{label}</span>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      Error: {message}
    </div>
  );
}

function EmptyBox({ label = 'No data available' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center p-8 text-sm text-on-surface-variant/60">
      {label}
    </div>
  );
}

function WarningBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-700">
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────
// Tooltip Components
// ─────────────────────────────────────────────

function DiagnosisTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { code: string; description: string; count: number; percentage: number } }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded border border-outline-variant bg-surface-lowest px-3 py-2 text-xs shadow">
      <p className="font-medium">{d.code} — {d.description}</p>
      <p>Count: {d.count}</p>
      <p>Percentage: {d.percentage.toFixed(1)}%</p>
    </div>
  );
}

function ScaleTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded border border-outline-variant bg-surface-lowest px-3 py-2 text-xs shadow">
      <p className="font-medium">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
        </p>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// KPI Cards Section
// ─────────────────────────────────────────────

function KpiCards({ data, isLoading, error }: {
  data: OverviewResponse | undefined;
  isLoading: boolean;
  error: Error | null;
}) {
  if (error) return <ErrorBox message={error.message} />;

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-outline-variant bg-surface-lowest p-6 shadow-card"
          >
            <div className="mb-2 h-4 w-20 rounded bg-gray-200" />
            <div className="h-8 w-16 rounded bg-gray-300" />
          </div>
        ))}
      </div>
    );
  }

  const overview = data.data;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-lg border border-outline-variant bg-surface-lowest p-6 shadow-card">
        <h3 className="text-sm font-medium text-on-surface-variant">Pacientes activos</h3>
        <p className="mt-1 text-2xl font-bold text-on-surface">
          {overview.totalPatients}
        </p>
        <p className="mt-1 text-xs text-on-surface-variant/60">
          {overview.newPatients} nuevos en el período
        </p>
      </div>
      <div className="rounded-lg border border-outline-variant bg-surface-lowest p-6 shadow-card">
        <h3 className="text-sm font-medium text-on-surface-variant">Cirugías realizadas</h3>
        <p className="mt-1 text-2xl font-bold text-on-surface">
          {overview.totalSurgeries}
        </p>
        <p className="mt-1 text-xs text-on-surface-variant/60">en el período</p>
      </div>
      <div className="rounded-lg border border-outline-variant bg-surface-lowest p-6 shadow-card">
        <h3 className="text-sm font-medium text-on-surface-variant">Consultas / paciente</h3>
        <p className="mt-1 text-2xl font-bold text-on-surface">
          {overview.avgConsultationsPerPatient.toFixed(1)}
        </p>
        <p className="mt-1 text-xs text-on-surface-variant/60">promedio en el período</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Top Diagnoses Section
// ─────────────────────────────────────────────

function TopDiagnoses({ data, isLoading, error }: {
  data: DiagnosesResponse | undefined;
  isLoading: boolean;
  error: Error | null;
}) {
  if (error) return <ErrorBox message={error.message} />;
  if (isLoading) return <Spinner label="Loading diagnosis data..." />;

  const diagnoses = data?.data ?? [];
  if (diagnoses.length === 0) {
    return <EmptyBox label="No diagnosis data available" />;
  }

  const chartData = diagnoses.map((d, i) => ({
    ...d,
    color: BAR_COLORS[i % BAR_COLORS.length],
    label: `${d.code} — ${d.description}`,
  }));

  return (
    <div className="h-96 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 10, right: 30, bottom: 10, left: 10 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e5e7eb"
            horizontal={false}
          />
          <XAxis type="number" tick={{ fontSize: 11 }} stroke="#6b7280" />
          <YAxis
            type="category"
            dataKey="label"
            width={220}
            tick={{ fontSize: 10 }}
            stroke="#6b7280"
          />
          <Tooltip content={<DiagnosisTooltip />} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────
// Scale Evolution Section
// ─────────────────────────────────────────────

function ScaleEvolutionChart({
  scaleType,
  from,
  to,
}: {
  scaleType: string;
  from?: string;
  to?: string;
}) {
  const { data, isLoading, error } = useScaleEvolution(scaleType, from, to);

  if (error) return <ErrorBox message={error.message} />;
  if (isLoading) return <Spinner label={`Loading ${SCALE_SHORT_LABELS[scaleType] ?? scaleType} data...`} />;

  const scaleData = data?.data;
  if (!scaleData || scaleData.trend.length === 0) {
    return (
      <EmptyBox
        label={`No ${SCALE_SHORT_LABELS[scaleType] ?? scaleType} scale data available`}
      />
    );
  }

  const lineColor = LINE_COLORS[scaleType] ?? '#2563eb';
  const label = SCALE_SHORT_LABELS[scaleType] ?? scaleType;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-on-surface">{label} — Evolution</h4>
        <span className="text-xs text-on-surface-variant/60">
          n={scaleData.sampleSize}
        </span>
      </div>

      {scaleData.warning && (
        <WarningBanner message="Tamaño de muestra insuficiente para significancia estadística" />
      )}

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={scaleData.trend}
            margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e5e7eb"
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11 }}
              stroke="#6b7280"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="#6b7280"
            />
            <Tooltip content={<ScaleTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="avgScore"
              name="Avg Score"
              stroke={lineColor}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────

export function AnalyticsDashboard() {
  const [period, setPeriod] = useState<PeriodOption>('1Y');

  const { from, to } = useMemo(() => getPeriodDates(period), [period]);

  const {
    data: overview,
    isLoading: overviewLoading,
    error: overviewError,
  } = useAnalyticsOverview(from, to);

  const {
    data: diagnoses,
    isLoading: diagnosesLoading,
    error: diagnosesError,
  } = useDiagnosisDistribution(from, to);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-on-surface">Analytics</h1>

        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as PeriodOption)}
          className="rounded-lg border border-outline bg-surface-lowest px-3 py-2 text-sm text-on-surface-variant shadow-card focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="mt-6">
        <KpiCards
          data={overview}
          isLoading={overviewLoading}
          error={overviewError}
        />
      </div>

      {/* Charts Grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Top Diagnoses */}
        <div className="rounded-lg border border-outline-variant bg-surface-lowest p-6 shadow-card">
          <h2 className="mb-4 text-sm font-semibold text-on-surface">
            Top Diagnoses (ICD-10)
          </h2>
          <TopDiagnoses
            data={diagnoses}
            isLoading={diagnosesLoading}
            error={diagnosesError}
          />
        </div>

        {/* Scale Evolution */}
        <div className="rounded-lg border border-outline-variant bg-surface-lowest p-6 shadow-card">
          <h2 className="mb-4 text-sm font-semibold text-on-surface">
            Scale Evolution
          </h2>
          <div className="space-y-8">
            <ScaleEvolutionChart
              scaleType="SNOT_22"
              from={from}
              to={to}
            />
            <ScaleEvolutionChart
              scaleType="DHI"
              from={from}
              to={to}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
