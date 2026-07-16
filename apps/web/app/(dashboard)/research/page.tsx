'use client';

// apps/web/app/(dashboard)/research/page.tsx
// Research landing — saved queries list with last-run info (BR-RES-001: only
// the caller's own + shared queries are returned). Buttons: new query, open,
// delete.

import Link from 'next/link';
import { useQueryHistory, useDeleteQuery } from '@/hooks/useResearch';

export default function ResearchPage() {
  const { data, isLoading } = useQueryHistory(1, 50);
  const del = useDeleteQuery();

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Investigación clínica</h1>
          <p className="text-sm text-gray-600">
            Construye consultas sobre pacientes importados y estándar; guarda cohortes y exporta datos anónimos.
          </p>
        </div>
        <Link
          href="/research/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Nueva consulta
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Cargando consultas…</p>
      ) : data && data.items.length > 0 ? (
        <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
          {data.items.map((q) => (
            <li key={q.id} className="flex items-center justify-between px-4 py-3">
              <Link href={`/research/${q.id}`} className="flex-1">
                <div className="font-medium text-gray-800">{q.name}</div>
                <div className="text-xs text-gray-500">
                  Origen: {q.dataSource} · Última ejecución:{' '}
                  {q.lastRunAt ? `${new Date(q.lastRunAt).toLocaleDateString()} (${q.lastRunCount ?? 0} pacientes)` : '—'}
                </div>
              </Link>
              <div className="flex items-center gap-2">
                <Link href={`/research/${q.id}`} className="rounded px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50">
                  Abrir
                </Link>
                <button
                  type="button"
                  onClick={() => { if (confirm('¿Eliminar la consulta guardada?')) void del.mutateAsync(q.id); }}
                  disabled={del.isPending}
                  className="rounded px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">
          No hay consultas guardadas. Crea la primera con «Nueva consulta».
        </p>
      )}
    </div>
  );
}