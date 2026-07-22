'use client';

// apps/web/src/components/research/collection-manager.tsx
// Create / lock / inspect patient collections. BR-RES-003: locked collections
// cannot have members added or removed; the API returns 403 (CollectionLocked)
// and we surface the message. Locking is idempotent.

import { useState } from 'react';
import {
  useCollections,
  useCreateCollection,
  useLockCollection,
} from '@/hooks/useResearch';

export interface CollectionManagerProps {
  /** Active query whose result can be snapshotted into a new collection. */
  queryId?: string;
  /** Optional explicit patientIds to seed a manual collection. */
  patientIds?: string[];
}

export function CollectionManager({ queryId, patientIds }: CollectionManagerProps) {
  const { data, isLoading } = useCollections(1, 50);
  const create = useCreateCollection();
  const lock = useLockCollection();
  const [name, setName] = useState('');

  const onCreate = async () => {
    if (!name.trim()) return;
    await create.mutateAsync({
      name: name.trim(),
      queryId,
      patientIds: patientIds?.length ? patientIds : undefined,
    });
    setName('');
  };

  const onLock = async (collectionId: string) => {
    if (!confirm('¿Bloquear la colección para publicación? Será inmutable (BR-RES-003).')) return;
    try {
      await lock.mutateAsync(collectionId);
    } catch (e) {
      alert(`No se pudo bloquear: ${(e as Error).message}`);
    }
  };

  return (
    <section className="space-y-3 rounded-md border border-outline-variant p-3">
      <h3 className="text-sm font-semibold text-on-surface-variant">Colecciones de pacientes</h3>

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre de la colección"
          className="flex-1 rounded border border-outline px-2 py-1 text-sm"
          disabled={create.isPending}
        />
        <button
          type="button"
          onClick={() => void onCreate()}
          disabled={create.isPending || !name.trim() || (!queryId && !patientIds?.length)}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
          title={!queryId && !patientIds?.length ? 'Ejecuta una consulta primero' : ''}
        >
          {create.isPending ? 'Creando…' : 'Crear desde cohorte'}
        </button>
      </div>
      {create.isError && (
        <p className="text-xs text-red-600">Error: {(create.error as Error).message}</p>
      )}

      {isLoading ? (
        <p className="text-sm text-on-surface-variant">Cargando…</p>
      ) : data && data.items.length > 0 ? (
        <ul className="divide-y divide-outline-variant rounded border border-outline-variant">
          {data.items.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <span className="font-medium text-on-surface">{c.name}</span>
                <span className="ml-2 text-on-surface-variant">{c.patientCount} pacientes</span>
                {c.isLocked && (
                  <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700" title="BR-RES-003: inmutable">
                    🔒 bloqueada
                  </span>
                )}
              </div>
              {!c.isLocked && (
                <button
                  type="button"
                  onClick={() => void onLock(c.id)}
                  disabled={lock.isPending}
                  className="rounded px-2 py-1 text-xs text-on-surface-variant hover:bg-surface-container"
                >
                  Bloquear
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-on-surface-variant">Aún no hay colecciones.</p>
      )}
    </section>
  );
}