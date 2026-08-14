'use client';

// apps/web/src/components/research/FilterBuilderV2/FilterBuilderV2.tsx
// Filter builder V2 (spec §9, design §Frontend). Replaces the v1 free-text form
// with field-discovery autocomplete + a debounced live preview (cohort count +
// 5-row sample) rendered as the physician edits. Clinical-precision styling.
//
// Controlled component — parent owns `filters`/`logic` (so the draft can be
// saved or executed). The live preview fires an ad-hoc /queries/execute call
// (no ResearchQuery row is persisted — spec §8 ad-hoc execution).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Filter, FilterLogic, DataSource } from '@medicore/contracts';
import type { FieldCatalogEntry, FieldType } from '@medicore/contracts';
import { FieldDiscoveryPopover } from '../FieldDiscoveryPopover';
import { useExecuteAdHoc, type AdHocResultRow } from '@/hooks/useResearchV2';

type Source = Filter['source'];
type Operator = Filter['operator'];

const SOURCES: Source[] = ['standard', 'imported', 'consultation', 'surgery', 'medication', 'scale'];

const NO_VALUE_OPS = new Set<Operator>([
  'is_empty', 'is_not_empty', 'boolean_true', 'boolean_false',
]);
const RANGE_OPS = new Set<Operator>(['between', 'date_between']);

const ALL_OPERATORS: Operator[] = [
  'equals', 'not_equals', 'contains', 'not_contains', 'starts_with',
  'greater_than', 'less_than', 'between', 'is_empty', 'is_not_empty',
  'in_list', 'date_before', 'date_after', 'date_between',
  'boolean_true', 'boolean_false',
];

const SOURCE_LABELS: Record<Source, string> = {
  standard: 'Campos estándar',
  imported: 'Campos importados',
  consultation: 'Consultas',
  surgery: 'Cirugías',
  medication: 'Medicación',
  scale: 'Escalas',
};

const OPERATOR_LABELS: Record<Operator, string> = {
  equals: 'Es igual a',
  not_equals: 'No es igual a',
  contains: 'Contiene',
  not_contains: 'No contiene',
  starts_with: 'Empieza por',
  greater_than: 'Mayor que',
  less_than: 'Menor que',
  between: 'Entre',
  is_empty: 'Está vacío',
  is_not_empty: 'No está vacío',
  in_list: 'Está en la lista',
  date_before: 'Antes de',
  date_after: 'Después de',
  date_between: 'Entre fechas',
  boolean_true: 'Sí',
  boolean_false: 'No',
};

const OPERATORS_BY_TYPE: Record<FieldType, Operator[]> = {
  string: ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'is_empty', 'is_not_empty', 'in_list'],
  number: ['equals', 'not_equals', 'greater_than', 'less_than', 'between', 'is_empty', 'is_not_empty', 'in_list'],
  date: ['equals', 'not_equals', 'date_before', 'date_after', 'date_between', 'is_empty', 'is_not_empty'],
  boolean: ['equals', 'not_equals', 'is_empty', 'is_not_empty', 'boolean_true', 'boolean_false'],
};

function operatorsFor(type?: FieldType): Operator[] {
  return type ? OPERATORS_BY_TYPE[type] : ALL_OPERATORS;
}

const EMPTY_FILTER: Filter = {
  field: '',
  source: 'standard',
  operator: 'equals',
  value: '',
};

const CONTROL_CLASSES =
  'border-outline bg-surface-lowest text-on-surface placeholder:text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1';

export interface FilterBuilderV2Props {
  filters: Filter[];
  logic: FilterLogic;
  onChange: (filters: Filter[], logic: FilterLogic) => void;
  /** Cohort context for the live preview (defaults to all_patients). */
  dataSource?: DataSource;
  importBatchIds?: string[];
  /** Fields to include in the preview sample rows (defaults to first filter field). */
  previewFields?: string[];
  disabled?: boolean;
  /** Debounce window for the live preview in ms (default 400). */
  debounceMs?: number;
}

/**
 * Live preview panel: cohort count + a 5-row anonymized sample, updated as the
 * physician edits filters. Calls the ad-hoc execute endpoint — never mutates
 * saved queries (spec §8). Empty/invalid filter rows are pruned server-side.
 */
function LivePreview({
  filters,
  logic,
  dataSource,
  importBatchIds,
  previewFields,
  debounceMs,
}: {
  filters: Filter[];
  logic: FilterLogic;
  dataSource?: DataSource;
  importBatchIds?: string[];
  previewFields?: string[];
  debounceMs: number;
}) {
  const exec = useExecuteAdHoc();
  const [preview, setPreview] = useState<{ totalRows: number; sample: AdHocResultRow[] } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmed = filters.filter((f) => f.field.trim().length > 0);

  const run = useCallback(async () => {
    if (trimmed.length === 0) {
      setPreview(null);
      return;
    }
    try {
      const displayFields = previewFields && previewFields.length > 0
        ? previewFields
        : Array.from(new Set(trimmed.map((f) => f.field)));
      const result = await exec.mutateAsync({
        filters: trimmed,
        filterLogic: logic,
        dataSource: dataSource ?? 'all_patients',
        importBatchIds: importBatchIds ?? [],
        displayFields,
        statsMode: 'descriptive',
        limit: 5,
      });
      setPreview({ totalRows: result.totalRows, sample: (result.rows ?? []).slice(0, 5) });
    } catch {
      // Live preview is non-blocking: a failed preview must never throw into the UI.
      setPreview(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed.map((f) => `${f.field}:${f.operator}:${f.value ?? ''}:${f.valueTo ?? ''}`).join('|'), logic, dataSource, importBatchIds?.join('|'), previewFields?.join('|')]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void run(), debounceMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [run, debounceMs]);

  const displayFields = previewFields && previewFields.length > 0
    ? previewFields
    : Array.from(new Set(trimmed.map((f) => f.field)));

  return (
    <div className="mt-3 rounded-md border border-outline-variant bg-surface-lowest p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Previsualización en vivo
        </span>
        <span
          className="rounded px-2 py-0.5 text-sm font-bold"
          style={{ fontVariantNumeric: 'tabular-nums' }}
          aria-live="polite"
        >
          {exec.isPending
            ? '…'
            : preview
              ? `${preview.totalRows.toLocaleString()} pacientes`
              : trimmed.length === 0
                ? 'Sin filtros'
                : '—'}
        </span>
      </div>

      {preview && preview.sample.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr className="border-b border-outline-variant text-on-surface-variant">
                <th className="px-1 py-1 text-left">NHC</th>
                {displayFields.map((f) => (
                  <th key={f} className="px-1 py-1 text-left">{f}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.sample.map((row) => (
                <tr key={row.patientId} className="border-b border-outline-variant/50">
                  <td className="px-1 py-1">{row.nhc}</td>
                  {displayFields.map((f) => (
                    <td key={f} className="px-1 py-1">
                      {row.fields[f] === null || row.fields[f] === undefined ? '—' : String(row.fields[f])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-1 text-[11px] text-on-surface-variant">
        Anonimizado · no se guarda la consulta (ejecución ad-hoc).
      </p>
    </div>
  );
}

export function FilterBuilderV2({
  filters,
  logic,
  onChange,
  dataSource,
  importBatchIds,
  previewFields,
  disabled,
  debounceMs = 400,
}: FilterBuilderV2Props) {
  // Type metadata is UI state only: Filter's persisted contract intentionally
  // stores field names and sources, not inferred catalog metadata.
  const [fieldTypes, setFieldTypes] = useState<Record<string, FieldType>>({});

  const update = (index: number, patch: Partial<Filter>) => {
    const next = filters.map((f, i) => (i === index ? { ...f, ...patch } : f));
    onChange(next, logic);
  };
  const addRow = () => onChange([...filters, { ...EMPTY_FILTER }], logic);
  const removeRow = (index: number) => onChange(filters.filter((_, i) => i !== index), logic);
  const setLogic = (l: FilterLogic) => onChange(filters, l);

  const fieldTypeKey = (filter: Filter) => `${filter.source}:${filter.field}`;
  const typeFor = (filter: Filter) => fieldTypes[fieldTypeKey(filter)];
  const handleCatalogSelect = (index: number, entry: FieldCatalogEntry) => {
    const current = filters[index];
    const nextOperators = operatorsFor(entry.type);
    setFieldTypes((types) => ({ ...types, [`${entry.source}:${entry.field}`]: entry.type }));
    update(index, {
      field: entry.field,
      source: entry.source,
      operator: nextOperators.includes(current.operator) ? current.operator : 'equals',
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-outline-variant bg-surface-low p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-on-surface-variant">Combinar filtros:</span>
        <div className="inline-flex overflow-hidden rounded-md border border-outline">
          {(['AND', 'OR'] as FilterLogic[]).map((l) => (
            <button
              key={l}
              type="button"
              disabled={disabled}
              onClick={() => setLogic(l)}
              className={`px-3 py-1 text-sm ${
                logic === l ? 'bg-primary text-on-primary' : 'bg-surface-lowest text-on-surface-variant hover:bg-surface-low'
              } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {filters.length === 0 && (
        <p className="text-sm text-on-surface-variant">
          Sin filtros. Pulsa «Añadir filtro» para acotar la cohorte.
        </p>
      )}

      <div className="space-y-2">
        {filters.map((filter, i) => (
          <div
            key={i}
            className="flex flex-wrap items-center gap-2 rounded-md border border-outline-variant bg-surface-lowest p-2"
          >
            <select
              disabled={disabled}
              value={filter.source}
              onChange={(e) => update(i, { source: e.target.value as Source, field: '' })}
              className={`rounded border px-2 py-1 text-sm ${CONTROL_CLASSES}`}
              aria-label="Origen del dato"
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
              ))}
            </select>

            <div className="min-w-[200px] flex-1">
              {filter.source === 'standard' || filter.source === 'imported' ? (
                <FieldDiscoveryPopover
                  value={filter.field}
                  disabled={disabled}
                  source={filter.source}
                  onSelect={(entry) => handleCatalogSelect(i, entry)}
                  ariaLabel={`Campo del filtro ${i + 1}`}
                />
              ) : (
                <input
                  type="text"
                  disabled={disabled}
                  value={filter.field}
                  onChange={(e) => update(i, { field: e.target.value })}
                  placeholder="Nombre del campo de la relación"
                  className={`w-full rounded border px-2 py-1 text-sm ${CONTROL_CLASSES}`}
                  aria-label={`Campo del filtro ${i + 1}`}
                />
              )}
            </div>

            <select
              disabled={disabled}
              value={filter.operator}
              onChange={(e) => update(i, { operator: e.target.value as Operator })}
              className={`rounded border px-2 py-1 text-sm ${CONTROL_CLASSES}`}
              aria-label="Operador"
            >
              {operatorsFor(typeFor(filter)).map((o) => (
                <option key={o} value={o}>{OPERATOR_LABELS[o]}</option>
              ))}
            </select>

            {!NO_VALUE_OPS.has(filter.operator) && !RANGE_OPS.has(filter.operator) && (
              typeFor(filter) === 'boolean' ? (
                <select
                  disabled={disabled}
                  value={String(filter.value ?? '')}
                  onChange={(e) => update(i, { value: e.target.value === 'true' })}
                  className={`w-32 rounded border px-2 py-1 text-sm ${CONTROL_CLASSES}`}
                  aria-label="Valor booleano"
                >
                  <option value="">Seleccionar</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <input
                  type={typeFor(filter) === 'number' ? 'number' : typeFor(filter) === 'date' ? 'date' : 'text'}
                  inputMode={typeFor(filter) === 'number' ? 'decimal' : undefined}
                  disabled={disabled}
                  value={String(filter.value ?? '')}
                  onChange={(e) => update(i, { value: e.target.value })}
                  placeholder="valor"
                  className={`w-32 rounded border px-2 py-1 text-sm ${CONTROL_CLASSES}`}
                />
              )
            )}

            {RANGE_OPS.has(filter.operator) && (
              <>
                <input
                  type={typeFor(filter) === 'date' ? 'date' : typeFor(filter) === 'number' ? 'number' : 'text'}
                  inputMode={typeFor(filter) === 'number' ? 'decimal' : undefined}
                  disabled={disabled}
                  value={String(filter.value ?? '')}
                  onChange={(e) => update(i, { value: e.target.value })}
                  placeholder="desde"
                  className={`w-20 rounded border px-2 py-1 text-sm ${CONTROL_CLASSES}`}
                />
                <span className="text-on-surface-variant/60">–</span>
                <input
                  type={typeFor(filter) === 'date' ? 'date' : typeFor(filter) === 'number' ? 'number' : 'text'}
                  inputMode={typeFor(filter) === 'number' ? 'decimal' : undefined}
                  disabled={disabled}
                  value={String(filter.valueTo ?? '')}
                  onChange={(e) => update(i, { valueTo: e.target.value })}
                  placeholder="hasta"
                  className={`w-20 rounded border px-2 py-1 text-sm ${CONTROL_CLASSES}`}
                />
              </>
            )}

            <button
              type="button"
              disabled={disabled}
              onClick={() => removeRow(i)}
              className="ml-auto rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Quitar
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={addRow}
        className="rounded-md border border-outline-variant bg-surface-lowest px-3 py-1.5 text-sm text-primary hover:bg-surface-low disabled:opacity-50"
      >
        + Añadir filtro
      </button>

      <LivePreview
        filters={filters}
        logic={logic}
        dataSource={dataSource}
        importBatchIds={importBatchIds}
        previewFields={previewFields}
        debounceMs={debounceMs}
      />
    </div>
  );
}

export default FilterBuilderV2;
