'use client';

// apps/web/src/components/research/TableOneBuilder/TableOneBuilder.tsx
// Table 1 builder (M2): field selection (checkboxes), manual stat override
// toggle (force mean±SD or median(IQR)), optional group-by selector, and a
// live preview table. Renders categorical as n(%), numeric as auto-selected.

import { useMemo, useState } from 'react';
import { FieldDiscoveryPopover } from '../FieldDiscoveryPopover';
import { StatOverrideToggle } from './StatOverrideToggle';
import {
  useTableOne, useTableOneCompare,
  type TableOneRequest, type TableOneResult, type TableOneFieldResult,
} from '@/hooks/useStudiesWithBadges';

const SCALE_TYPES = ['SNOT_22', 'VAS_TINNITUS', 'DHI', 'VHI', 'RSI', 'OSA_EPWORTH', 'STOPBANG', 'NOSE'];

export interface TableOneBuilderProps {
  studyId: string;
  availableFields?: string[];
}

export function TableOneBuilder({ studyId, availableFields }: TableOneBuilderProps) {
  const [fields, setFields] = useState<string[]>(availableFields ?? []);
  const [overrides, setOverrides] = useState<Record<string, 'mean_sd' | 'median_iqr'>>({});
  const [groupBy, setGroupBy] = useState<string>('');
  const [pendingField, setPendingField] = useState('');

  const tableOne = useTableOne();
  const compare = useTableOneCompare();
  const mutation = groupBy ? compare : tableOne;
  const result = (mutation.data ?? null) as TableOneResult | null;

  function addField(field: string) {
    if (!field || fields.includes(field)) return;
    setFields((f) => [...f, field]);
    setPendingField('');
  }

  async function run() {
    const req: TableOneRequest = { studyId, fields, overrides };
    if (groupBy) req.groupBy = groupBy;
    await mutation.mutateAsync(req);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase text-on-surface-variant">Añadir campo</label>
        <div className="mt-1 flex gap-2">
          <FieldDiscoveryPopover
            value={pendingField}
            onSelect={(e) => addField(e.field)}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {fields.map((f) => (
            <span key={f} className="inline-flex items-center gap-1 rounded bg-surface-low px-2 py-0.5 text-xs">
              {f}
              <button type="button" onClick={() => setFields((fs) => fs.filter((x) => x !== f))} aria-label="Quitar">·</button>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-on-surface-variant">Agrupar por (comparación)</label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="mt-1 rounded border border-outline px-2 py-1 text-sm"
          >
            <option value="">— Sin agrupar —</option>
            {SCALE_TYPES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {fields.map((f) => (
        <StatOverrideToggle
          key={f}
          field={f}
          value={overrides[f]}
          onChange={(v) =>
            setOverrides((o) => {
              const next = { ...o };
              if (v === '') delete next[f];
              else next[f] = v;
              return next;
            })
          }
        />
      ))}

      <button
        type="button"
        onClick={() => void run()}
        disabled={fields.length === 0 || mutation.isPending}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary disabled:opacity-50"
      >
        {mutation.isPending ? 'Generando…' : 'Generar Tabla 1'}
      </button>

      {result && <TableOnePreview result={result} />}
    </div>
  );
}

function describeCell(r: TableOneFieldResult): string {
  if (r.representation === 'categorical') {
    return r.categories.map((c) => `${c.label}: ${c.count} (${c.percent}%)`).join('; ');
  }
  if (r.representation === 'mean_sd') return `${r.mean} ± ${r.sd}`;
  return `${r.median} (${r.q1}–${r.q3})`;
}

function TableOnePreview({ result }: { result: TableOneResult }) {
  const rows = useMemo(() => result.fields, [result]);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-outline text-sm">
        <thead>
          <tr className="bg-surface-low text-left">
            <th className="border-b border-outline px-2 py-1">Variable</th>
            <th className="border-b border-outline px-2 py-1">n</th>
            <th className="border-b border-outline px-2 py-1">Estadístico</th>
            {result.groupBy && <th className="border-b border-outline px-2 py-1">p</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.field}>
              <td className="border-b border-outline px-2 py-1 font-medium">{r.field}</td>
              <td className="border-b border-outline px-2 py-1">{r.n}</td>
              <td className="border-b border-outline px-2 py-1">{describeCell(r)}</td>
              {result.groupBy && <td className="border-b border-outline px-2 py-1">{r.pValue ?? '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {result.warnings.length > 0 && (
        <ul className="mt-2 text-xs text-on-surface-variant">
          {result.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
        </ul>
      )}
    </div>
  );
}

export default TableOneBuilder;