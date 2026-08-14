'use client';

// apps/web/app/(dashboard)/research/page.tsx
// Research landing — saved queries list with last-run info (BR-RES-001: only
// the caller's own + shared queries are returned). Buttons: new query, open,
// delete.
//
// V3: when RESEARCH_V3_STUDIES flag is ON, redirect to the Studies dashboard.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useQueryHistory, useDeleteQuery } from '@/hooks/useResearch';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

export default function ResearchPage() {
  const isV3Studies = useFeatureFlag('RESEARCH_V3_STUDIES');
  const router = useRouter();

  useEffect(() => {
    if (isV3Studies) router.replace('/research/studies');
  }, [isV3Studies, router]);
  const { data, isLoading } = useQueryHistory(1, 50);
  const del = useDeleteQuery();

  if (isV3Studies) {
    return <p className="text-sm text-on-surface-variant">Redirigiendo a estudios…</p>;
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">Investigación clínica</h1>
          <p className="text-sm text-on-surface-variant">
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
        <p className="text-sm text-on-surface-variant">Cargando consultas…</p>
      ) : data && data.items.length > 0 ? (
        <ul className="divide-y divide-outline-variant rounded-md border border-outline-variant">
          {data.items.map((q) => (
            <li key={q.id} className="flex items-center justify-between px-4 py-3">
              <Link href={`/research/${q.id}`} className="flex-1">
                <div className="font-medium text-on-surface">{q.name}</div>
                <div className="text-xs text-on-surface-variant">
                  Origen: {q.dataSource} · Última ejecución:{' '}
                  {q.lastRunAt ? `${new Date(q.lastRunAt).toLocaleDateString()} (${q.lastRunCount ?? 0} pacientes)` : '—'}
                </div>
              </Link>
              <div className="flex items-center gap-2">
                <Link href={`/research/${q.id}`} className="rounded px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50">
                  Abrir
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { if (confirm('¿Eliminar la consulta guardada?')) void del.mutateAsync(q.id); }}
                  disabled={del.isPending}
                  className="text-red-600 hover:text-red-800"
                >
                  Eliminar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-on-surface-variant">
          No hay consultas guardadas. Crea la primera con «Nueva consulta».
        </p>
      )}
    </div>
  );
}
