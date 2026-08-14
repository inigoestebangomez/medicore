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

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useFieldCatalog } from '@/hooks/useResearchV2';
import type { FieldCatalogEntry, FieldType, FieldSourceV2 } from '@medicore/contracts';
import { clinicalColors } from '../../../tokens/clinical';
import {
  CLINICAL_SECTION_LABELS,
  groupBySection,
} from './clinical-sections.registry';
import { formatFieldMetadata, formatFieldOrigin, getFieldLabel } from './field-presentation';

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
  /** Reuse a catalog already loaded by a parent picker. */
  catalogEntries?: FieldCatalogEntry[];
  catalogLoading?: boolean;
  /** Optional content rendered above the catalog options. */
  topContent?: ReactNode;
  /** Controlled open state for composite pickers. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  inputRef?: RefObject<HTMLInputElement>;
  totalPatients?: number;
}

const TYPE_BADGE: Record<FieldType, { label: string; color: string }> = {
  string: { label: 'TXT', color: clinicalColors.neutral.onLight },
  number: { label: '#', color: clinicalColors.info.onLight },
  date: { label: 'FECHA', color: clinicalColors.success.onLight },
  boolean: { label: 'BOOL', color: clinicalColors.warning.onLight },
};

export function FieldDiscoveryPopover({
  value,
  onSelect,
  source,
  type,
  placeholder = 'Buscar campo (p.ej. EVA, age, nhc…)',
  disabled,
  ariaLabel = 'Campo',
  catalogEntries,
  catalogLoading = false,
  topContent,
  open,
  onOpenChange,
  inputRef,
  totalPatients,
}: FieldDiscoveryPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState(value ?? '');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const isOpen = open ?? internalOpen;
  const { data, isLoading } = useFieldCatalog(query, type, isOpen && catalogEntries === undefined);
  const cohortTotal = totalPatients ?? data?.totalPatients;

  function setPopoverOpen(next: boolean) {
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }

  // Keep the input in sync when the parent resets the value externally.
  useEffect(() => {
    setQuery(value ?? '');
  }, [value]);

  // Close on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setPopoverOpen(false);
    }
    if (isOpen) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [isOpen]);

  const entries = useMemo(() => {
    const catalog = catalogEntries ?? data?.entries ?? [];
    const list = catalogEntries
      ? catalog.filter((entry) => {
          const normalizedQuery = query.trim().toLocaleLowerCase();
          return !normalizedQuery || `${entry.field} ${getFieldLabel(entry.field, entry)} ${(entry.originalHeaders ?? []).join(' ')}`.toLocaleLowerCase().includes(normalizedQuery);
        })
      : catalog;
    return (source ? list.filter((e) => e.source === source) : list).slice(0, 50);
  }, [catalogEntries, data, query, source]);

  // Group entries by clinical section (M1) — collapsible groups.
  const sections = useMemo(() => groupBySection(entries), [entries]);

  function handlePick(entry: FieldCatalogEntry) {
    setQuery(entry.field);
    setPopoverOpen(false);
    onSelect(entry);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        disabled={disabled}
        ref={inputRef}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        value={query}
        placeholder={placeholder}
        onFocus={() => setPopoverOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setPopoverOpen(true);
        }}
        className="w-full rounded border border-outline bg-surface-lowest px-2 py-1 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-50"
      />

      {isOpen && (
        <div
          className="absolute z-30 mt-1 max-h-[32rem] w-full overflow-auto rounded-md border border-outline-variant bg-surface-lowest shadow-dropdown"
        >
          {topContent}

          <div role="listbox" aria-label="Catálogo de campos">
            {(catalogEntries === undefined ? isLoading : catalogLoading) && (
              <div className="px-3 py-2 text-sm text-on-surface-variant">Buscando campos…</div>
            )}

            {!(catalogEntries === undefined ? isLoading : catalogLoading) && entries.length === 0 && (
              <div className="px-3 py-2 text-sm text-on-surface-variant">
                No se encontraron campos{query ? ` para «${query}»` : ''}.
              </div>
            )}

            {sections.map(({ section, entries: sectionEntries }) => {
              const isCollapsed = collapsed[section];
              return (
                <div key={section}>
                  <button
                    type="button"
                    onClick={() => setCollapsed((c) => ({ ...c, [section]: !c[section] }))}
                    className="flex w-full items-center justify-between bg-surface-low px-3 py-1 text-left text-[11px] font-bold uppercase tracking-wide text-on-surface-variant"
                  >
                    <span>{CLINICAL_SECTION_LABELS[section]}</span>
                    <span aria-hidden>{isCollapsed ? '▸' : '▾'}</span>
                  </button>
                  {!isCollapsed &&
                    sectionEntries.map((entry) => {
                      const badge = TYPE_BADGE[entry.type];
                      const label = getFieldLabel(entry.field, entry);
                      const origin = formatFieldOrigin(entry);
                      return (
                        <button
                          key={`${entry.source}:${entry.field}`}
                          type="button"
                          role="option"
                          aria-selected={entry.field === value}
                          aria-label={`${label} (${entry.field})`}
                          onClick={() => handlePick(entry)}
                          className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-surface-low"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-on-surface">{label}</span>
                              {label !== entry.field && (
                                <span className="truncate text-xs text-on-surface-variant" title={`Clave técnica: ${entry.field}`}>
                                  {entry.field}
                                </span>
                              )}
                              <span
                                className="rounded px-1 text-[10px] font-bold uppercase"
                                style={{ color: badge.color }}
                              >
                                {badge.label}
                              </span>
                              <span className="rounded bg-surface-low px-1 text-[10px] uppercase text-on-surface-variant">
                                {entry.source === 'imported' ? 'importado' : 'estándar'}
                              </span>
                            </div>
                            <div className="mt-0.5 truncate text-xs text-on-surface-variant">
                              {formatFieldMetadata(entry, cohortTotal)}
                            </div>
                            {origin && (
                              <div className="mt-0.5 truncate text-[11px] text-on-surface-variant" title={origin}>
                                {origin}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default FieldDiscoveryPopover;
