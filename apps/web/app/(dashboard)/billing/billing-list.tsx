'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useBillingTransactions, type BillingType, type BillingStatus, type BillingTransaction } from '@/hooks/useBilling';

const TYPE_OPTIONS: (BillingType | '')[] = ['', 'CONSULTATION', 'SURGERY', 'TREATMENT', 'SUBSCRIPTION', 'OTHER'];
const STATUS_OPTIONS: (BillingStatus | '')[] = ['', 'PENDING', 'PAID', 'CANCELLED', 'REFUNDED'];

function formatEnum(key: string): string {
  return key
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_BADGE: Record<BillingStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-surface-container text-on-surface-variant',
  REFUNDED: 'bg-red-100 text-red-800',
};

export function BillingList({
  onEdit,
}: {
  onEdit?: (tx: BillingTransaction) => void;
}) {
  const [page, setPage] = useState(1);
  const [type, setType] = useState<BillingType | ''>('');
  const [status, setStatus] = useState<BillingStatus | ''>('');

  const { data, isLoading, error } = useBillingTransactions({
    page,
    pageSize: 20,
    type: type || undefined,
    status: status || undefined,
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-on-surface">Facturación</h2>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="text-sm text-on-surface-variant">
          Tipo
          <select
            value={type}
            onChange={(e) => { setType(e.target.value as any); setPage(1); }}
            className="ml-2 rounded border border-outline px-2 py-1 text-sm"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{t === '' ? 'Todos' : formatEnum(t)}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-on-surface-variant">
          Estado
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value as any); setPage(1); }}
            className="ml-2 rounded border border-outline px-2 py-1 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === '' ? 'Todos' : formatEnum(s)}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface-lowest">
        <table className="min-w-full divide-y divide-outline-variant">
          <thead className="bg-surface-low">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-on-surface-variant">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-on-surface-variant">Descripción</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-on-surface-variant">Tipo</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-on-surface-variant">Estado</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-on-surface-variant">Importe</th>
              {onEdit && (
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-on-surface-variant">
                  <span className="sr-only">Acciones</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {isLoading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-on-surface-variant/60">Cargando…</td></tr>
            )}
            {error && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-red-500">Error: {error.message}</td></tr>
            )}
            {data && data.items.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-on-surface-variant/60">Sin transacciones</td></tr>
            )}
            {data?.items.map((t) => (
              <tr key={t.id} className="hover:bg-surface-low">
                <td className="px-4 py-3 text-sm text-on-surface-variant">
                  {new Date(t.date).toLocaleDateString('es-ES')}
                </td>
                <td className="px-4 py-3 text-sm text-on-surface-variant">{t.description ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-on-surface-variant">{formatEnum(t.type)}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[t.status]}`}>
                    {formatEnum(t.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-sm tabular-nums text-on-surface">
                  {t.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-on-surface-variant">
        <span>{data ? `${data.total} transacciones` : '—'}</span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Anterior
          </Button>
          <span className="px-2 py-1">Página {page} de {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => (p < totalPages ? p + 1 : p))}
            disabled={page >= totalPages}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}