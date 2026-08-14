'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  useBillingStats,
  useBillingTransactions,
  type BillingTransaction,
} from '@/hooks/useBilling';
import { BillingList } from './billing-list';
import { TrendChart } from './components/trend-chart';
import { TransactionModal } from './components/transaction-modal';

function formatEUR(value: number): string {
  return value.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });
}

function formatEnum(key: string): string {
  return key
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─────────────────────────────────────────────
// Loading / Error / Empty states
// ─────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-outline-variant bg-surface-lowest p-6 shadow-card"
        >
          <div className="mb-2 h-4 w-24 rounded bg-surface-low" />
          <div className="h-8 w-20 rounded bg-surface-container" />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// KPI Cards
// ─────────────────────────────────────────────

interface KpiCardsProps {
  totalThisMonth: number;
  percentChange: number;
  transactionCount: number | null;
}

function KpiCards({ totalThisMonth, percentChange, transactionCount }: KpiCardsProps) {
  const trendingUp = percentChange >= 0;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-lg border border-outline-variant bg-surface-lowest p-6 shadow-card">
        <h3 className="text-sm font-medium text-on-surface-variant">Total este mes</h3>
        <p className="mt-1 text-2xl font-bold text-on-surface tabular-nums">
          {formatEUR(totalThisMonth)}
        </p>
      </div>

      <div className="rounded-lg border border-outline-variant bg-surface-lowest p-6 shadow-card">
        <h3 className="text-sm font-medium text-on-surface-variant">Cambio vs mes anterior</h3>
        <p
          className={`mt-1 flex items-center gap-1 text-2xl font-bold tabular-nums ${
            trendingUp ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          <span aria-hidden="true">{trendingUp ? '▲' : '▼'}</span>
          {Math.abs(percentChange).toFixed(1)}%
        </p>
      </div>

      <div className="rounded-lg border border-outline-variant bg-surface-lowest p-6 shadow-card">
        <h3 className="text-sm font-medium text-on-surface-variant">Transacciones</h3>
        <p className="mt-1 text-2xl font-bold text-on-surface tabular-nums">
          {transactionCount ?? '—'}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// By-type breakdown
// ─────────────────────────────────────────────

function ByTypeBreakdown({ byType }: { byType: Record<string, number> }) {
  const entries = Object.entries(byType);
  if (entries.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-on-surface-variant/60">
        Sin desglose por tipo
      </div>
    );
  }

  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <ul className="space-y-2">
      {entries.map(([type, amount]) => (
        <li key={type}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-on-surface-variant">{formatEnum(type)}</span>
            <span className="tabular-nums text-on-surface">{formatEUR(amount)}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-low">
            <div
              className="h-full rounded-full bg-aqua-gradient"
              style={{ width: `${(amount / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────

export function BillingDashboard() {
  const { data: stats, isLoading, error } = useBillingStats();
  // refreshSignal lets child list/components trigger a stats refetch after mutations.
  const [, setRefreshSignal] = useState(0);
  // Modal state: open flag + optional transaction being edited.
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BillingTransaction | null>(null);
  // Headline transaction count sourced from list endpoint total.
  const { data: listData } = useBillingTransactions({ page: 1, pageSize: 1 });

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(tx: BillingTransaction) {
    setEditing(tx);
    setModalOpen(true);
  }

  function handleClose() {
    setModalOpen(false);
    setEditing(null);
  }

  function handleMutated() {
    setRefreshSignal((n) => n + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-on-surface">Facturación</h1>
        <Button onClick={openCreate}>Nueva transacción</Button>
      </div>

      {/* KPI cards */}
      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          Error cargando estadísticas: {error.message}
        </div>
      ) : isLoading || !stats ? (
        <KpiSkeleton />
      ) : (
        <KpiCards
          totalThisMonth={stats.totalThisMonth}
          percentChange={stats.change.percent}
          transactionCount={listData?.total ?? null}
        />
      )}

      {/* Trend chart + by-type breakdown */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-outline-variant bg-surface-lowest p-6 shadow-card lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-on-surface">Tendencia mensual</h2>
          {error ? null : isLoading ? (
            <div className="flex h-64 items-center justify-center text-sm text-on-surface-variant/60">
              Cargando…
            </div>
          ) : (
            <TrendChart data={stats?.monthly ?? []} />
          )}
        </div>

        <div className="rounded-lg border border-outline-variant bg-surface-lowest p-6 shadow-card">
          <h2 className="mb-4 text-sm font-semibold text-on-surface">Por tipo</h2>
          <ByTypeBreakdown byType={stats?.byType ?? {}} />
        </div>
      </div>

      {/* Existing transaction list */}
      <BillingList onEdit={openEdit} />

      {/* Create / edit modal */}
      <TransactionModal
        open={modalOpen}
        onClose={handleClose}
        transaction={editing}
        onMutated={handleMutated}
      />
    </div>
  );
}

// Re-export the transaction type for convenience used by the modal layer.
export type { BillingTransaction };
