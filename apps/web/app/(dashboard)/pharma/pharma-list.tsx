'use client';

import { useState } from 'react';
import { usePharmaContacts, usePharmaInteractions, type PharmaContact } from '@/hooks/usePharma';

function formatEnum(key: string): string {
  return key
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PharmaList() {
  const [selected, setSelected] = useState<PharmaContact | null>(null);
  const [page] = useState(1);

  const { data, isLoading, error } = usePharmaContacts({ page, pageSize: 20 });
  const interactionsQuery = usePharmaInteractions(selected?.id ?? null);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-on-surface">Contactos farmacéuticos</h2>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface-lowest lg:col-span-2">
          <table className="min-w-full divide-y divide-outline-variant">
            <thead className="bg-surface-low">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-on-surface-variant">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-on-surface-variant">Empresa</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-on-surface-variant">Últ. contacto</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-on-surface-variant">Próx. seguimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {isLoading && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-on-surface-variant/60">Cargando…</td></tr>
              )}
              {error && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-red-500">Error: {error.message}</td></tr>
              )}
              {data && data.items.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-on-surface-variant/60">Sin contactos</td></tr>
              )}
              {data?.items.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={`cursor-pointer hover:bg-surface-low ${selected?.id === c.id ? 'bg-secondary-container/20' : ''}`}
                >
                  <td className="px-4 py-3 text-sm text-on-surface">
                    {c.name}
                    {c.role ? <span className="block text-xs text-on-surface-variant">{c.role}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">{c.company}</td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">
                    {c.lastContactAt ? new Date(c.lastContactAt).toLocaleDateString('es-ES') : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">
                    {c.nextFollowUpAt ? new Date(c.nextFollowUpAt).toLocaleDateString('es-ES') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-outline-variant bg-surface-lowest p-4">
          <h3 className="text-sm font-semibold text-on-surface-variant">
            {selected ? `Interacciones — ${selected.name}` : 'Selecciona un contacto'}
          </h3>

          {selected && (
            <div className="mt-2 space-y-1 text-xs text-on-surface-variant">
              <p>{selected.company}{selected.role ? ` · ${selected.role}` : ''}</p>
              {selected.email && <p>{selected.email}</p>}
              {selected.phone && <p>{selected.phone}</p>}
            </div>
          )}

          <ul className="mt-3 space-y-2">
            {interactionsQuery.isLoading && <li className="text-sm text-on-surface-variant/60">Cargando…</li>}
            {interactionsQuery.error && (
              <li className="text-sm text-red-500">Error: {interactionsQuery.error.message}</li>
            )}
            {interactionsQuery.data && interactionsQuery.data.items.length === 0 && (
              <li className="text-sm text-on-surface-variant/60">Sin interacciones</li>
            )}
            {interactionsQuery.data?.items.map((i) => (
              <li key={i.id} className="rounded border border-outline-variant p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-on-surface-variant">{formatEnum(i.type)}</span>
                  <span className="text-xs text-on-surface-variant/60">
                    {new Date(i.date).toLocaleDateString('es-ES')}
                  </span>
                </div>
                {i.notes && <p className="mt-1 text-xs text-on-surface-variant">{i.notes}</p>}
                {i.followUpNeeded && (
                  <span className="mt-1 inline-block rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] text-yellow-800">
                    Seguimiento pendiente
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}