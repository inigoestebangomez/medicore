'use client';

// apps/web/src/features/research-form/components/VariableBuilder/RangeEditor.tsx
// RangeEditor (REQ-FB-001): min/max/step for CONTINUOUS / DISCRETE variables.
// The contract VariableRange.min/max are optional numbers (not nullable).

import type { VariableRange } from '@medicore/contracts';

export function RangeEditor({
  range,
  onChange,
}: {
  range: VariableRange | null;
  onChange: (r: VariableRange | null) => void;
}) {
  const r: VariableRange = range ?? { step: 1 };
  const set = (patch: Partial<VariableRange>) => onChange({ ...r, ...patch });
  return (
    <div className="space-y-1">
      <span className="text-xs font-semibold text-on-surface">Rango (opcional)</span>
      <div className="flex gap-2">
        <label className="text-xs">
          min
          <input
            type="number"
            value={r.min ?? ''}
            onChange={(e) => set({ min: e.target.value === '' ? undefined : Number(e.target.value) })}
            className="w-24 rounded border border-outline bg-surface px-2 py-1"
          />
        </label>
        <label className="text-xs">
          max
          <input
            type="number"
            value={r.max ?? ''}
            onChange={(e) => set({ max: e.target.value === '' ? undefined : Number(e.target.value) })}
            className="w-24 rounded border border-outline bg-surface px-2 py-1"
          />
        </label>
        <label className="text-xs">
          step
          <input
            type="number"
            value={r.step ?? 1}
            onChange={(e) => set({ step: Number(e.target.value) || 1 })}
            className="w-20 rounded border border-outline bg-surface px-2 py-1"
          />
        </label>
      </div>
    </div>
  );
}

export default RangeEditor;