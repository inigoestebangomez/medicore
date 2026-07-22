// apps/web/app/(dashboard)/dashboard/dashboard-client.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useDashboardStats, type DashboardStats } from '@/hooks/useAnalytics';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  YAxis,
} from 'recharts';

type CardKind = 'patients' | 'appointments' | 'surgeries' | 'treatments' | 'billing' | 'schedule';

interface CardConfig {
  kind: CardKind;
  label: string;
  href?: string;
  seriesField: 'new' | 'count' | 'total';
}

const CARDS: CardConfig[] = [
  { kind: 'patients', label: 'Pacientes', href: '/patients', seriesField: 'new' },
  { kind: 'appointments', label: 'Consultas', seriesField: 'count' },
  { kind: 'surgeries', label: 'Cirugías', seriesField: 'count' },
  { kind: 'treatments', label: 'Tratamientos', href: '/patients', seriesField: 'new' },
  { kind: 'billing', label: 'Facturación', href: '/billing', seriesField: 'total' },
  { kind: 'schedule', label: 'Agenda', href: '/schedule', seriesField: 'total' },
];

interface WidgetConfig {
  patients: boolean;
  appointments: boolean;
  surgeries: boolean;
  treatments: boolean;
  billing: boolean;
  schedule: boolean;
}

const WIDGET_STORAGE_KEY = 'medicore-dashboard-widgets';

const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  patients: true,
  appointments: true,
  surgeries: true,
  treatments: true,
  billing: true,
  schedule: true,
};

function loadWidgetConfig(): WidgetConfig {
  if (typeof window === 'undefined') return DEFAULT_WIDGET_CONFIG;
  try {
    const raw = window.localStorage.getItem(WIDGET_STORAGE_KEY);
    if (!raw) return DEFAULT_WIDGET_CONFIG;
    const parsed = JSON.parse(raw) as Partial<WidgetConfig>;
    return { ...DEFAULT_WIDGET_CONFIG, ...parsed };
  } catch {
    return DEFAULT_WIDGET_CONFIG;
  }
}

const PERIOD_LABEL: Record<'month' | 'week', string> = {
  month: 'vs mes anterior',
  week: 'vs semana anterior',
};

function bigNumber(stats: DashboardStats | undefined, kind: CardKind): number {
  if (!stats) return 0;
  switch (kind) {
    case 'patients':
      return stats.patients.total;
    case 'appointments':
      return stats.appointments.total;
    case 'surgeries':
      return stats.surgeries.total;
    case 'treatments':
      return stats.treatments.active;
    case 'billing':
      return stats.billing.totalThisMonth;
    case 'schedule':
      return stats.schedule.todayAppointments;
  }
}

function change(stats: DashboardStats | undefined, kind: CardKind) {
  if (!stats) return undefined;
  switch (kind) {
    case 'patients':
      return stats.patients.change;
    case 'appointments':
      return stats.appointments.change;
    case 'surgeries':
      return stats.surgeries.change;
    case 'treatments':
      // Treatments have no change object; synthesize one from newThisMonth vs active.
      return undefined;
    case 'billing':
      return stats.billing.change;
    case 'schedule':
      return undefined;
  }
}

function series(stats: DashboardStats | undefined, kind: CardKind, field: 'new' | 'count' | 'total'): Array<{ x: string; y: number }> {
  if (!stats) return [];
  let rows: Array<{ month?: string; week?: string; new?: number; count?: number; total?: number }> = [];
  switch (kind) {
    case 'patients':
      rows = stats.patients.monthly;
      break;
    case 'appointments':
      rows = stats.appointments.weekly;
      break;
    case 'surgeries':
      rows = stats.surgeries.monthly;
      break;
    case 'treatments':
      rows = stats.treatments.monthly;
      break;
    case 'billing':
      rows = stats.billing.monthly;
      break;
    case 'schedule':
      rows = [];
      break;
  }
  return rows.map((r) => ({
    x: (r.month ?? r.week ?? '') as string,
    y: (r[field] ?? 0) as number,
  }));
}

function Sparkline({ data }: { data: Array<{ x: string; y: number }> }) {
  if (data.length === 0) {
    return <div className="h-20 w-full" aria-hidden />;
  }
  return (
    <div className="h-20 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Area
            type="monotone"
            dataKey="y"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#spark-fill)"
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChangeBadge({ value, percent, period }: { value: number; percent: number; period: 'month' | 'week' }) {
  if (value === 0 && percent === 0) return null;
  const up = value >= 0;
  const arrow = up ? '↗︎' : '↘︎';
  const color = up ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50';
  const sign = value > 0 ? '+' : '';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      <span aria-hidden>{arrow}</span>
      <span>
        {sign}
        {value} ({percent.toFixed(2).replace(/\.?0+$/, '')}%)
      </span>
      <span className="text-on-surface-variant/60 font-normal">{PERIOD_LABEL[period]}</span>
    </span>
  );
}

function StatCard({
  config,
  stats,
  isLoading,
}: {
  config: CardConfig;
  stats: DashboardStats | undefined;
  isLoading: boolean;
}) {
  const router = useRouter();
  const total = bigNumber(stats, config.kind);
  const ch = change(stats, config.kind);
  const data = series(stats, config.kind, config.seriesField);

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-lg border border-outline-variant bg-surface-lowest p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 rounded bg-gray-200" />
          <div className="h-4 w-4 rounded bg-gray-200" />
        </div>
        <div className="mt-6 h-8 w-28 rounded bg-gray-200" />
        <div className="mt-3 h-4 w-40 rounded bg-gray-200" />
        <div className="mt-4 h-20 w-full rounded bg-gray-100" />
      </div>
    );
  }

  const isCurrency = config.kind === 'billing';
  const formatted = isCurrency
    ? `${total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`
    : total.toLocaleString('es-ES');

  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-on-surface-variant">{config.label}</span>
        {ch && <ChangeBadge value={ch.value} percent={ch.percent} period={ch.period} />}
      </div>

      <div className="mt-4 text-3xl font-semibold text-on-surface">
        {formatted}
      </div>

      {config.kind === 'treatments' && stats && (
        <div className="mt-1 text-xs text-on-surface-variant">
          {stats.treatments.newThisMonth} nuevos este mes
        </div>
      )}

      {config.kind === 'schedule' && stats && (
        <div className="mt-1 text-xs text-on-surface-variant">
          {stats.schedule.todaySurgeries} cirugías hoy
          {stats.schedule.nextAppointment
            ? ` · próxima ${stats.schedule.nextAppointment.time} ${stats.schedule.nextAppointment.patientName}`
            : ''}
        </div>
      )}

      <div className="mt-3">
        <Sparkline data={data} />
      </div>
    </>
  );

  const className =
    'rounded-lg border border-outline-variant bg-surface-lowest p-5 text-left shadow-card transition hover:border-secondary hover:shadow-dropdown focus:outline-none focus:ring-2 focus:ring-secondary';

  // Cards without a dedicated page are non-interactive.
  if (!config.href) {
    return <div className={className.replace(/hover:\S+|focus:\S+/g, '')}>{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => router.push(config.href!)}
      className={className}
    >
      {body}
    </button>
  );
}

const WIDGET_LABELS: Record<CardKind, string> = {
  patients: 'Pacientes',
  appointments: 'Consultas',
  surgeries: 'Cirugías',
  treatments: 'Tratamientos',
  billing: 'Facturación',
  schedule: 'Agenda',
};

export function DashboardClient() {
  const { data: stats, isLoading } = useDashboardStats();
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig>(DEFAULT_WIDGET_CONFIG);
  const [showSettings, setShowSettings] = useState(false);

  // Load config from localStorage on mount (client-only).
  useEffect(() => {
    setWidgetConfig(loadWidgetConfig());
  }, []);

  // Persist to localStorage whenever config changes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(widgetConfig));
    } catch {
      // ignore quota / serialization errors
    }
  }, [widgetConfig]);

  function toggleWidget(kind: CardKind) {
    setWidgetConfig((prev) => ({ ...prev, [kind]: !prev[kind] }));
  }

  function resetWidgets() {
    setWidgetConfig(DEFAULT_WIDGET_CONFIG);
  }

  const visibleCards = CARDS.filter((c) => widgetConfig[c.kind]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Dashboard</h1>
          <p className="mt-2 text-on-surface-variant">Resumen general de la actividad clínica.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSettings((v) => !v)}
          aria-expanded={showSettings}
          aria-controls="widget-settings"
        >
          Personalizar
        </Button>
      </div>

      {showSettings && (
        <div
          id="widget-settings"
          className="mt-4 rounded-lg border border-outline-variant bg-surface-lowest p-5 shadow-card"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-on-surface">Widgets visibles</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetWidgets}
            >
              Restablecer
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(WIDGET_LABELS) as CardKind[]).map((kind) => (
              <label
                key={kind}
                className="flex items-center gap-2 rounded-md border border-outline-variant px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-low"
              >
                <input
                  type="checkbox"
                  checked={widgetConfig[kind]}
                  onChange={() => toggleWidget(kind)}
                  className="h-4 w-4 rounded border-outline text-secondary focus:ring-secondary"
                />
                {WIDGET_LABELS[kind]}
              </label>
            ))}
          </div>
        </div>
      )}

      {visibleCards.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visibleCards.map((c) => (
            <StatCard key={c.kind} config={c} stats={stats} isLoading={isLoading} />
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-outline bg-surface-lowest p-8 text-center text-sm text-on-surface-variant">
          No hay widgets activos. Pulsa «Personalizar» para mostrarlos.
        </div>
      )}

      {stats && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <DetailPanel
            title="Consultas por tipo"
            rows={Object.entries(stats.appointments.byType)}
          />
          <DetailPanel
            title="Cirugías por estado"
            rows={Object.entries(stats.surgeries.byStatus)}
          />
          <DetailPanel
            title="Facturación por tipo"
            rows={Object.entries(stats.billing.byType)}
          />
        </div>
      )}
    </div>
  );
}

function DetailPanel({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  const total = rows.reduce((sum, [, n]) => sum + n, 0);
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-lowest p-5 shadow-card">
      <h3 className="text-sm font-medium text-on-surface-variant">{title}</h3>
      <ul className="mt-3 space-y-2">
        {rows.length === 0 && <li className="text-sm text-on-surface-variant/60">Sin datos</li>}
        {rows.map(([key, n]) => (
          <li key={key} className="flex items-center justify-between text-sm">
            <span className="text-on-surface-variant">{formatEnum(key)}</span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 overflow-hidden rounded bg-surface-container">
                <div
                  className="h-2 bg-blue-500"
                  style={{ width: total > 0 ? `${(n / total) * 100}%` : '0%' }}
                />
              </div>
              <span className="tabular-nums text-on-surface">{n}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatEnum(key: string): string {
  return key
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}