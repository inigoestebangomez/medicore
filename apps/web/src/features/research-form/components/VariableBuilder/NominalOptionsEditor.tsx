'use client';

// apps/web/src/features/research-form/components/VariableBuilder/NominalOptionsEditor.tsx
// NominalOptionsEditor (REQ-FB-001): closed-catalogue editor for NOMINAL /
// ORDINAL variables. Analysis-bound categoricals must use a closed list,
// never free text (doc 07 §3 rule 2).

import type { VariableOption } from '@medicore/contracts';

export function NominalOptionsEditor({
  options,
  onChange,
}: {
  options: VariableOption[];
  onChange: (opts: VariableOption[]) => void;
}) {
  const update = (i: number, patch: Partial<VariableOption>) =>
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  const add = () => onChange([...options, { value: '', label: '' }]);
  const remove = (i: number) => onChange(options.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-on-surface">Opciones del catálogo</span>
      {options.map((o, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={o.value}
            onChange={(e) => update(i, { value: e.target.value })}
            placeholder="valor"
            className="w-28 rounded border border-outline bg-surface px-2 py-1 text-xs"
          />
          <input
            value={o.label}
            onChange={(e) => update(i, { label: e.target.value })}
            placeholder="etiqueta"
            className="flex-1 rounded border border-outline bg-surface px-2 py-1 text-xs"
          />
          <button type="button" onClick={() => remove(i)} className="text-xs text-error" aria-label="Eliminar opción">
            ✕
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="rounded border border-outline px-2 py-1 text-xs hover:bg-surface-low">
        + Añadir opción
      </button>
    </div>
  );
}

export default NominalOptionsEditor;