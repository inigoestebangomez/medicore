'use client';

// apps/web/src/components/research/FieldDiscoveryPopover.tsx
// Field-discovery autocomplete (spec §5, design AD-3). Renders the org's field
// catalog (standard + imported) with inferred type badges, non-null count and
// up to 5 example values. Built on the server-cached FieldDiscoveryService via
// useFieldCatalog — no client-side catalog scan.
//
// shadcn/cmdk is not installed in this workspace, so this is a lightweight
// combobox: an input + absolutely-positioned dropdown filtered from the
// server response. Virtualization is unnecessary — the catalog is bounded by
// the org's imported schema (typically <200 fields).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFieldCatalog } from '@/hooks/useResearchV2';
import type { FieldCatalogEntry, FieldType, FieldSourceV2 } from '@medicore/contracts';
import { clinicalColors } from '../../../tokens/clinical';

export interface FieldDiscoveryPopoverProps {
  /** Currently selected field name (controlled). */
  value: string;
  /** Called when the user picks an entry from the catalog. */
  onSelect: (entry: FieldCatalogEntry) => void;
  /** Restrict suggestions to a source. */
  source?: FieldSourceV2;
  /** Restrict suggestions to an inferred type. */
  type?: FieldType;
  /** Placeholder for the search input. */
  placeholder?: string;
  disabled?: boolean;
  /** Optional ARIA label. */
  ariaLabel?: string;
}

const TYPE_BADGE: Record<FieldType, { label: string; color: string }> = {
  string: { label: 'TXT', color: clinicalColors.neutral.onLight },
  number: { label: '#', color: clinicalColors.info.onLight },
  date: { label: 'FECHA', color: clinicalColors.success.onLight },
  boolean: { label: 'BOOL', color: clinicalColors.warning.onLight },
};

function formatExample(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v.length > 24 ? `${v.slice(0, 24)}…` : v;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

export function FieldDiscoveryPopover({
  value,
  onSelect,
  source,
  type,
  placeholder = 'Buscar campo (p.ej. EVA, age, nhc…)',
  disabled,
  ariaLabel = 'Campo',
}: FieldDiscoveryPopoverProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value ?? '');
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useFieldCatalog(query, type, open);

  // Keep the input in sync when the parent resets the value externally.
  useEffect(() => {
    setQuery(value ?? '');
  }, [value]);

  // Close on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const entries = useMemo(() => {
    const list = data?.entries ?? [];
    return (source ? list.filter((e) => e.source === source) : list).slice(0, 50);
  }, [data, source]);

  function handlePick(entry: FieldCatalogEntry) {
    setQuery(entry.field);
    setOpen(false);
    onSelect(entry);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        disabled={disabled}
        aria-label={ariaLabel}
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        className="w-full rounded border border-outline px-2 py-1 text-sm focus:border-secondary focus:outline-none disabled:opacity-50"
      />

      {open && (
        <div
          role="listbox"
          aria-label="Catálogo de campos"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border border-outline-variant bg-surface-lowest shadow-dropdown"
        >
          {isLoading && <div className="px-3 py-2 text-sm text-on-surface-variant">Buscando campos…</div>}

          {!isLoading && entries.length === 0 && (
            <div className="px-3 py-2 text-sm text-on-surface-variant">
              No se encontraron campos{query ? ` para «${query}»` : ''}.
            </div>
          )}

          {entries.map((entry) => {
            const badge = TYPE_BADGE[entry.type];
            return (
              <button
                key={`${entry.source}:${entry.field}`}
                type="button"
                role="option"
                aria-selected={entry.field === value}
                onClick={() => handlePick(entry)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-surface-low"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-on-surface">{entry.field}</span>
                    <span
                      className="rounded px-1 text-[10px] font-bold uppercase"
                      style={{ color: badge.color }}
                    >
                      {badge.label}
                    </span>
                    <span className="rounded bg-surface-low px-1 text-[10px] uppercase text-on-surface-variant">
                      {entry.source === 'imported' ? 'import' : 'std'}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-on-surface-variant">
                    {entry.nonNullCount.toLocaleString()} no nulos · ej:{' '}
                    {entry.examples.slice(0, 5).map(formatExample).join(', ')}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default FieldDiscoveryPopover;
