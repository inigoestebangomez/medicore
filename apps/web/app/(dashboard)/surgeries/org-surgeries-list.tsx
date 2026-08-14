'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useOrgSurgeries } from '@/hooks/useSurgeries';
import type { SurgeryStatus } from '@medicore/contracts';

const STATUS_OPTIONS: (SurgeryStatus | '')[] = ['', 'SCHEDULED', 'POSTPONED', 'COMPLETED', 'CANCELLED'];

function formatEnum(key: string): string {
  return key
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_BADGE: Record<SurgeryStatus, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800',
  POSTPONED: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export function OrgSurgeriesList() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<SurgeryStatus | ''>('');
  const [physicianId, setPhysicianId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isLoading, error } = useOrgSurgeries({
    page,
    pageSize: 20,
    status,
    physicianId: physicianId || undefined,
    from: from || undefined,
    to: to || undefined,
  });

  const totalPages = data ? Math.max(1, data.totalPages) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-on-surface">Cirugías</h2>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="text-sm text-on-surface-variant">
          Estado
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as SurgeryStatus | '');
              setPage(1);
            }}
            className="ml-2 rounded border border-outline px-2 py-1 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === '' ? 'Todos' : formatEnum(s)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-on-surface-variant">
          Desde
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="ml-2 rounded border border-outline px-2 py-1 text-sm"
          />
        </label>

        <label className="text-sm text-on-surface-variant">
          Hasta
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="ml-2 rounded border border-outline px-2 py-1 text-sm"
          />
        </label>

        <label className="text-sm text-on-surface-variant">
          Cirujano (ID)
          <input
            type="text"
            value={physicianId}
            placeholder="UUID del médico"
            onChange={(e) => {
              setPhysicianId(e.target.value);
              setPage(1);
            }}
            className="ml-2 rounded border border-outline px-2 py-1 text-sm"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface-lowest">
        <table className="min-w-full divide-y divide-outline-variant">
          <thead className="bg-surface-low">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-on-surface-variant">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-on-surface-variant">Paciente</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-on-surface-variant">Procedimiento</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-on-surface-variant">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-on-surface-variant">Cirujano</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {isLoading && (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  <td colSpan={5} className="px-4 py-3 text-sm text-on-surface-variant/60">Cargando…</td>
                </tr>
              ))
            )}
            {error && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-red-500">
                  Error al cargar cirugías.{' '}
                  <button className="underline" onClick={() => window.location.reload()}>Reintentar</button>
                </td>
              </tr>
            )}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-on-surface-variant/60">
                  No hay cirugías en este periodo
                </td>
              </tr>
            )}
            {data?.items.map((s) => (
              <tr
                key={s.id}
                className="cursor-pointer hover:bg-surface-low"
                onClick={() => router.push(`/patients/${s.patientId}/surgeries/${s.id}`)}
              >
                <td className="px-4 py-3 text-sm text-on-surface-variant">
                  {new Date(s.date).toLocaleDateString('es-ES')}
                </td>
                <td className="px-4 py-3 text-sm text-on-surface">
                  {s.patientFirstName} {s.patientLastName}
                </td>
                <td className="px-4 py-3 text-sm text-on-surface-variant">{s.procedureType}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[s.status]}`}>
                    {formatEnum(s.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-on-surface-variant">
                  <span className="font-mono text-xs">{s.physicianId.slice(0, 8)}…</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-on-surface-variant">
        <span>{data ? `${data.total} cirugías` : '—'}</span>
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