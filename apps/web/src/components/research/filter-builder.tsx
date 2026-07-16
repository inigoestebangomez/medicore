'use client';

// apps/web/src/components/research/filter-builder.tsx
// Visual filter builder for the Research Engine (spec §9). Supports all 6
// FieldSource values and the operators from FilterOperatorSchema. Rows can be
// added/removed and combined with AND/OR logic.
//
// This is a controlled component — the parent owns the `filters` and
// `filterLogic` state so it can POST them straight to the save/execute hooks.

import type { Filter, FilterLogic } from '@medicore/contracts';

// Derive enum-like unions from the contract Filter shape (avoids importing
// FieldSource/FilterOperator which aren't re-exported from the barrel).
type Source = Filter['source'];
type Operator = Filter['operator'];

const SOURCES: Source[] = ['standard', 'imported', 'consultation', 'surgery', 'medication', 'scale'];

// Operators that do not need a value input.
const NO_VALUE_OPS = new Set<Operator>([
  'is_empty', 'is_not_empty', 'boolean_true', 'boolean_false',
]);
// Operators that take two values (a range).
const RANGE_OPS = new Set<Operator>(['between', 'date_between']);

export interface FilterBuilderProps {
  filters: Filter[];
  logic: FilterLogic;
  onChange: (filters: Filter[], logic: FilterLogic) => void;
  disabled?: boolean;
}

const EMPTY_FILTER: Filter = {
  field: '',
  source: 'standard',
  operator: 'equals',
  value: '',
};

export function FilterBuilder({ filters, logic, onChange, disabled }: FilterBuilderProps) {
  const update = (index: number, patch: Partial<Filter>) => {
    const next = filters.map((f, i) => (i === index ? { ...f, ...patch } : f));
    onChange(next, logic);
  };

  const addRow = () => onChange([...filters, { ...EMPTY_FILTER }], logic);
  const removeRow = (index: number) =>
    onChange(filters.filter((_, i) => i !== index), logic);

  const setLogic = (l: FilterLogic) => onChange(filters, l);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Combinar filtros:</span>
        <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
          {(['AND', 'OR'] as FilterLogic[]).map((l) => (
            <button
              key={l}
              type="button"
              disabled={disabled}
              onClick={() => setLogic(l)}
              className={`px-3 py-1 text-sm ${
                logic === l ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {filters.length === 0 && (
        <p className="text-sm text-gray-500">
          Sin filtros. Pulsa «Añadir filtro» para acotar la cohorte.
        </p>
      )}

      <div className="space-y-2">
        {filters.map((filter, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-2">
            <select
              disabled={disabled}
              value={filter.source}
              onChange={(e) => update(i, { source: e.target.value as Source, field: '' })}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
              aria-label="Origen del dato"
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <input
              disabled={disabled}
              value={filter.field}
              onChange={(e) => update(i, { field: e.target.value })}
              placeholder="campo (p.ej. age, nhc, customField…)"
              className="min-w-[180px] flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
            />

            <select
              disabled={disabled}
              value={filter.operator}
              onChange={(e) => update(i, { operator: e.target.value as Operator })}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
              aria-label="Operador"
            >
              {(['equals','not_equals','contains','not_contains','starts_with','greater_than','less_than','between','is_empty','is_not_empty','in_list','date_before','date_after','date_between','boolean_true','boolean_false'] as Operator[]).map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>

            {!NO_VALUE_OPS.has(filter.operator) && !RANGE_OPS.has(filter.operator) && (
              <input
                disabled={disabled}
                value={String(filter.value ?? '')}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder="valor"
                className="w-32 rounded border border-gray-300 px-2 py-1 text-sm"
              />
            )}

            {RANGE_OPS.has(filter.operator) && (
              <>
                <input
                  disabled={disabled}
                  value={String(filter.value ?? '')}
                  onChange={(e) => update(i, { value: e.target.value })}
                  placeholder="desde"
                  className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <span className="text-gray-400">–</span>
                <input
                  disabled={disabled}
                  value={String(filter.valueTo ?? '')}
                  onChange={(e) => update(i, { valueTo: e.target.value })}
                  placeholder="hasta"
                  className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
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
        className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-50"
      >
        + Añadir filtro
      </button>
    </div>
  );
}