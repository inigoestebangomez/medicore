'use client';

// apps/web/src/components/research/ShareDialog.tsx
// Share dialog (spec §7, BR-RES-001). Search intra-org colleagues, pick one or
// more, choose a permission (view/edit) and confirm. External org sharing is
// prohibited server-side; the client only offers colleagues passed by the
// parent (so only intra-org members are reachable here).

import { useMemo, useState } from 'react';
import type { SharePermission } from '@medicore/contracts';
import { useShareQuery } from '@/hooks/useResearchV2';

export interface ShareDialogProps {
  queryId: string;
  queryName: string;
  /** Intra-org colleagues (parent fetches the org roster). */
  colleagues: Array<{ id: string; name: string; email?: string }>;
  onClose: () => void;
  onShared?: (sharedUserIds: string[]) => void;
}

export function ShareDialog({ queryId, queryName, colleagues, onClose, onShared }: ShareDialogProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [permission, setPermission] = useState<SharePermission>('view');
  const share = useShareQuery();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return colleagues;
    return colleagues.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q),
    );
  }, [colleagues, search]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirm() {
    const userIds = [...selected];
    if (userIds.length === 0) return;
    await share.mutateAsync({ queryId, userIds, permission });
    onShared?.(userIds);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true" data-testid="share-dialog">
      <div className="w-full max-w-md rounded-lg border border-outline-variant bg-surface-lowest p-5 shadow-modal">
        <div className="flex items-center justify-between">
          <h2 className="text-headline-md text-on-surface">Compartir consulta</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-on-surface-variant hover:text-on-surface">✕</button>
        </div>
        <p className="mt-1 text-sm text-on-surface-variant">
          {queryName} · solo se comparte con colegas de tu organización (BR-RES-001).
        </p>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar colega por nombre o email…"
          className="mt-3 w-full rounded border border-outline px-2 py-1.5 text-sm"
          aria-label="Buscar colegas"
        />

        <ul className="mt-2 max-h-56 space-y-1 overflow-auto">
          {filtered.length === 0 && (
            <li className="px-2 py-1 text-sm text-on-surface-variant">Sin coincidencias.</li>
          )}
          {filtered.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-surface-low">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="accent-primary"
                />
                <span className="flex-1 text-sm text-on-surface">{c.name}</span>
                {c.email && <span className="text-xs text-on-surface-variant">{c.email}</span>}
              </label>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-on-surface-variant">Permiso:</span>
          <select
            value={permission}
            onChange={(e) => setPermission(e.target.value as SharePermission)}
            className="rounded border border-outline px-2 py-1 text-sm"
            aria-label="Permiso de uso"
          >
            <option value="view">Ver (view-only)</option>
            <option value="edit">Editar</option>
          </select>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-outline-variant px-3 py-1.5 text-sm text-on-surface hover:bg-surface-low">
            Cancelar
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || share.isPending}
            onClick={() => void confirm()}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-on-primary disabled:opacity-50"
          >
            {share.isPending ? 'Compartiendo…' : `Compartir con ${selected.size}`}
          </button>
        </div>
        {share.isError && (
          <p className="mt-2 text-xs text-red-600">No se pudo compartir la consulta. ¿Es el usuario de la misma organización?</p>
        )}
      </div>
    </div>
  );
}

export default ShareDialog;