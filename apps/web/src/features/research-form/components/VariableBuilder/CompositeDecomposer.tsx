'use client';

// apps/web/src/features/research-form/components/VariableBuilder/CompositeDecomposer.tsx
// CompositeDecomposer (REQ-FB-005): break a composite qualitative variable
// (e.g. "Complicaciones") into N independent DICHOTOMOUS children
// (hemorragia, infección, fallecimiento…). Each child becomes an
// independently analyzable variable.

import { useState } from 'react';
import type { StudyVariableResponse } from '@medicore/contracts';
import { useDecomposeVariable } from '@/features/research-form/api/useResearchForm';

export function CompositeDecomposer({
  studyId,
  parent,
}: {
  studyId: string;
  parent: StudyVariableResponse;
}) {
  const decompose = useDecomposeVariable(studyId);
  const [children, setChildren] = useState<Array<{ name: string; label: string }>>([
    { name: '', label: '' },
  ]);

  const update = (i: number, patch: Partial<{ name: string; label: string }>) =>
    setChildren(children.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const add = () => setChildren([...children, { name: '', label: '' }]);
  const remove = (i: number) => setChildren(children.filter((_, idx) => idx !== i));

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = children.filter((c) => c.name.trim() && c.label.trim());
    if (valid.length === 0) return;
    await decompose.mutateAsync({ parentVariableId: parent.id, children: valid });
    setChildren([{ name: '', label: '' }]);
  };

  return (
    <form onSubmit={run} className="space-y-2 rounded border border-outline bg-surface p-3">
      <p className="text-xs text-on-surface-variant">
        Descomponer <strong>{parent.label}</strong> en hijas dicotómicas (cada una analizable por separado).
      </p>
      {children.map((c, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={c.name}
            onChange={(e) => update(i, { name: e.target.value })}
            placeholder="nombre (p. ej. hemorragia)"
            className="w-40 rounded border border-outline px-2 py-1 text-xs"
          />
          <input
            value={c.label}
            onChange={(e) => update(i, { label: e.target.value })}
            placeholder="etiqueta"
            className="flex-1 rounded border border-outline px-2 py-1 text-xs"
          />
          <button type="button" onClick={() => remove(i)} className="text-xs text-error">✕</button>
        </div>
      ))}
      <div className="flex gap-2">
        <button type="button" onClick={add} className="rounded border border-outline px-2 py-1 text-xs hover:bg-surface-low">
          + Hija
        </button>
        <button
          type="submit"
          disabled={decompose.isPending}
          className="rounded bg-primary px-3 py-1 text-xs font-semibold text-on-primary disabled:opacity-50"
        >
          {decompose.isPending ? 'Descomponiendo…' : 'Descomponer'}
        </button>
      </div>
    </form>
  );
}

export default CompositeDecomposer;