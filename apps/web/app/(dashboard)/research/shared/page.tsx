'use client';

// apps/web/app/(dashboard)/research/shared/page.tsx
// Shared queries list (spec §7, BR-RES-001). Shows queries colleagues in the
// same org have shared with the current user, with a permission badge (view/
// edit) and a search box. External sharing is blocked server-side — this page
// only lists intra-org shares.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSharedQueries } from '@/hooks/useResearchV2';
import { clinicalColors } from '../../../../tokens/clinical';

export default function SharedQueriesPage() {
  const { data, isLoading } = useSharedQueries(1);
  const [search, setSearch] = useState('');

  const items = useMemo(() => {
    const list = data?.items ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((i) => i.name.toLowerCase().includes(q) || (i.ownerName ?? '').toLowerCase().includes(q));
  }, [data, search]);

  return (
    <div className="container mx-auto space-y-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-on-surface">Consultas compartidas</h1>
        <p className="text-sm text-on-surface-variant">
          Consultas que colegas de tu organización han compartido contigo (BR-RES-001).
        </p>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nombre o dueño…"
        className="w-full max-w-md rounded border border-outline px-2 py-1.5 text-sm"
        aria-label="Buscar consultas compartidas"
      />

      {isLoading ? (
        <p className="text-sm text-on-surface-variant">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No hay consultas compartidas contigo.</p>
      ) : (
        <ul className="divide-y divide-outline-variant rounded-md border border-outline-variant">
          {items.map((q) => (
            <li key={q.id} className="flex items-center justify-between px-4 py-3">
              <Link href={`/research/${q.id}`} className="flex-1">
                <div className="font-medium text-on-surface">{q.name}</div>
                <div className="text-xs text-on-surface-variant">
                  Compartido por {q.ownerName ?? '—'} · {q.dataSource}
                  {q.lastRunAt && ` · última ejec. ${new Date(q.lastRunAt).toLocaleDateString()} (${q.lastRunCount ?? 0})`}
                </div>
              </Link>
              <span
                className="rounded px-2 py-0.5 text-xs font-bold uppercase"
                style={{ color: q.permission === 'edit' ? clinicalColors.success.onLight : clinicalColors.info.onLight }}
                data-testid={`permission-${q.id}`}
              >
                {q.permission}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}