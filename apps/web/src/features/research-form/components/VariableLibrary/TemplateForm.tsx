'use client';

// apps/web/src/features/research-form/components/VariableLibrary/TemplateForm.tsx
// TemplateForm (REQ-FB-002): create a reusable org-level variable template.

import { useState } from 'react';
import type { VariableType, VariableOption, VariableRange } from '@medicore/contracts';
import { useCreateVariableTemplate } from '@/features/research-form/api/useResearchForm';
import { VariableTypePicker } from '@/features/research-form/components/VariableBuilder/VariableTypePicker';
import { NominalOptionsEditor } from '@/features/research-form/components/VariableBuilder/NominalOptionsEditor';
import { RangeEditor } from '@/features/research-form/components/VariableBuilder/RangeEditor';

export function TemplateForm() {
  const create = useCreateVariableTemplate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<VariableType>('CONTINUOUS');
  const [unit, setUnit] = useState('');
  const [options, setOptions] = useState<VariableOption[] | null>(null);
  const [range, setRange] = useState<VariableRange | null>(null);

  const needsOptions = type === 'NOMINAL' || type === 'ORDINAL';
  const needsRange = type === 'CONTINUOUS' || type === 'DISCRETE';
  const valid = name.trim() && (!needsOptions || (options && options.length > 0));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    await create.mutateAsync({
      name: name.trim(),
      description: description.trim() || undefined,
      type,
      unit: unit.trim() || undefined,
      options: needsOptions ? options : null,
      range: needsRange ? range : null,
    });
    setName(''); setDescription(''); setOptions(null); setRange(null);
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded border border-outline bg-surface p-3">
      <h2 className="text-sm font-semibold text-on-surface">Nueva plantilla de variable</h2>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (p. ej. Complicaciones ORL)" className="w-full rounded border border-outline px-2 py-1 text-sm" />
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción (opcional)" className="w-full rounded border border-outline px-2 py-1 text-sm" />
      <div className="grid gap-2 sm:grid-cols-2">
        <VariableTypePicker value={type} onChange={(t) => { setType(t); setOptions(null); setRange(null); }} />
        <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unidad (opcional)" className="rounded border border-outline px-2 py-1 text-sm" />
      </div>
      {needsOptions && <NominalOptionsEditor options={options ?? []} onChange={setOptions} />}
      {needsRange && <RangeEditor range={range} onChange={setRange} />}
      <button type="submit" disabled={!valid || create.isPending} className="rounded bg-primary px-3 py-1 text-xs font-semibold text-on-primary disabled:opacity-50">
        {create.isPending ? 'Guardando…' : 'Guardar plantilla'}
      </button>
    </form>
  );
}

export default TemplateForm;