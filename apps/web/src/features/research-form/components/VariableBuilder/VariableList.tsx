'use client';

// apps/web/src/features/research-form/components/VariableBuilder/VariableList.tsx
// VariableList + VariableRow (REQ-FB-004): sortable list of a study's
// variables. Reordering uses up/down arrows (accessible, keyboard-friendly)
// instead of dnd-kit, which is not a dependency — the design's dnd-kit
// preference is honoured in spirit by the move affordances. Each row supports
// inline metadata editing, decompose (composite), delete (history preserved in
// JSONB) and per-variable auto-fill opt-out.

import { useState } from 'react';
import type {
  StudyVariableResponse,
  StudyVariableInput,
  StudyVariableUpdate,
  VariableOption,
  VariableRange,
  VariableType,
} from '@medicore/contracts';
import {
  useCreateVariable,
  useUpdateVariable,
  useDeleteVariable,
  useReorderVariables,
} from '@/features/research-form/api/useResearchForm';
import { VariableTypePicker } from './VariableTypePicker';
import { NominalOptionsEditor } from './NominalOptionsEditor';
import { RangeEditor } from './RangeEditor';
import { CompositeDecomposer } from './CompositeDecomposer';
import { AutoFillToggle } from './AutoFillToggle';

export function VariableList({ studyId, variables }: { studyId: string; variables: StudyVariableResponse[] }) {
  const reorder = useReorderVariables(studyId);
  const remove = useDeleteVariable(studyId);

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...variables];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    reorder.mutate({ orderedIds: next.map((v) => v.id) });
  };

  return (
    <div className="space-y-3">
      <NewVariableForm studyId={studyId} />
      <ol className="space-y-2">
        {variables.map((v, idx) => (
          <li key={v.id}>
            <VariableRow
              studyId={studyId}
              variable={v}
              position={idx}
              total={variables.length}
              onMove={move}
              onDelete={() => remove.mutate(v.id)}
            />
          </li>
        ))}
        {variables.length === 0 && (
          <li className="rounded border border-dashed border-outline p-4 text-center text-sm text-on-surface-variant">
            Aún no hay variables. Añade la primera arriba.
          </li>
        )}
      </ol>
    </div>
  );
}

function NewVariableForm({ studyId }: { studyId: string }) {
  const create = useCreateVariable(studyId);
  // Loose draft: the StudyVariableInput is a discriminated union that is
  // awkward to satisfy field-by-field; we coerce to the union on submit.
  const [draft, setDraft] = useState<Record<string, unknown>>({
    name: '', label: '', type: 'CONTINUOUS', scope: 'CUSTOM',
    unit: undefined, required: false, isCore: false, position: 0,
    options: undefined, range: undefined, parentId: null,
  });
  const type = draft.type as VariableType;
  const needsOptions = type === 'NOMINAL' || type === 'ORDINAL';
  const needsRange = type === 'CONTINUOUS' || type === 'DISCRETE';
  const options = (draft.options as VariableOption[] | undefined) ?? null;
  const range = (draft.range as VariableRange | undefined) ?? null;
  const valid = Boolean(draft.name && draft.label) && (!needsOptions || (options && options.length > 0));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    await create.mutateAsync(draft as unknown as StudyVariableInput);
    setDraft({ ...draft, name: '', label: '', options: undefined, range: undefined });
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded border border-outline bg-surface p-3">
      <div className="flex gap-2">
        <input
          value={draft.name as string}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Nombre (p. ej. dias_hospitalizacion)"
          className="flex-1 rounded border border-outline px-2 py-1 text-sm"
        />
        <input
          value={draft.label as string}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          placeholder="Etiqueta visible"
          className="flex-1 rounded border border-outline px-2 py-1 text-sm"
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <VariableTypePicker value={type} onChange={(t) => setDraft({ ...draft, type: t, options: undefined, range: undefined })} />
        <label className="text-sm">
          <span className="font-semibold text-on-surface">Unidad</span>
          <input
            value={(draft.unit as string) ?? ''}
            onChange={(e) => setDraft({ ...draft, unit: e.target.value || undefined })}
            placeholder="p. ej. mg/L"
            className="w-full rounded border border-outline px-2 py-1"
          />
        </label>
      </div>
      {needsOptions && (
        <NominalOptionsEditor
          options={options ?? []}
          onChange={(opts: VariableOption[]) => setDraft({ ...draft, options: opts })}
        />
      )}
      {needsRange && (
        <RangeEditor range={range} onChange={(r: VariableRange | null) => setDraft({ ...draft, range: r ?? undefined })} />
      )}
      <label className="flex items-center gap-2 text-xs text-on-surface-variant">
        <input
          type="checkbox"
          checked={Boolean(draft.required)}
          onChange={(e) => setDraft({ ...draft, required: e.target.checked })}
        />
        Obligatoria (el núcleo fijo nunca bloquea el guardado)
      </label>
      <button
        type="submit"
        disabled={!valid || create.isPending}
        className="rounded bg-primary px-3 py-1 text-xs font-semibold text-on-primary disabled:opacity-50"
      >
        {create.isPending ? 'Guardando…' : '+ Añadir variable'}
      </button>
    </form>
  );
}

function VariableRow({
  studyId,
  variable,
  position,
  total,
  onMove,
  onDelete,
}: {
  studyId: string;
  variable: StudyVariableResponse;
  position: number;
  total: number;
  onMove: (idx: number, dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const update = useUpdateVariable(studyId);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(variable.label);
  const [options, setOptions] = useState<VariableOption[] | null>(variable.options);
  const [range, setRange] = useState<VariableRange | null>(variable.range);
  const [ehrPath, setEhrPath] = useState<string | null>(variable.options ? null : null);

  const needsOptions = variable.type === 'NOMINAL' || variable.type === 'ORDINAL';
  const needsRange = variable.type === 'CONTINUOUS' || variable.type === 'DISCRETE';

  const save = () => {
    const patch: StudyVariableUpdate = { label };
    if (needsOptions) patch.options = options;
    if (needsRange) patch.range = range;
    update.mutate({ variableId: variable.id, input: patch }, { onSuccess: () => setEditing(false) });
  };

  return (
    <div className="rounded border border-outline bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-on-surface">{variable.label}</div>
          <div className="text-xs text-on-surface-variant">
            <code>{variable.name}</code> · {variable.type}
            {variable.isCore && ' · núcleo fijo'}
            {variable.required && ' · obligatoria'}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onMove(position, -1)} disabled={position === 0} className="rounded border border-outline px-2 py-0.5 text-xs disabled:opacity-30" aria-label="Subir">↑</button>
          <button type="button" onClick={() => onMove(position, 1)} disabled={position === total - 1} className="rounded border border-outline px-2 py-0.5 text-xs disabled:opacity-30" aria-label="Bajar">↓</button>
          <button type="button" onClick={() => setEditing((s) => !s)} className="rounded border border-outline px-2 py-0.5 text-xs">Editar</button>
          {!variable.isCore && (
            <button type="button" onClick={onDelete} className="rounded border border-error px-2 py-0.5 text-xs text-error">Eliminar</button>
          )}
        </div>
      </div>
      {editing && (
        <div className="mt-3 space-y-2 border-t border-outline pt-3">
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full rounded border border-outline px-2 py-1 text-sm" />
          {needsOptions && <NominalOptionsEditor options={options ?? []} onChange={(o) => setOptions(o)} />}
          {needsRange && <RangeEditor range={range} onChange={(r) => setRange(r)} />}
          <AutoFillToggle variableId={variable.id} ehrPath={ehrPath} onChange={setEhrPath} />
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={update.isPending} className="rounded bg-primary px-3 py-1 text-xs font-semibold text-on-primary disabled:opacity-50">
              {update.isPending ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded border border-outline px-3 py-1 text-xs">Cancelar</button>
          </div>
        </div>
      )}
      {variable.type === 'NOMINAL' && (
        <div className="mt-2 border-t border-outline pt-2">
          <CompositeDecomposer studyId={studyId} parent={variable} />
        </div>
      )}
    </div>
  );
}

export default VariableList;