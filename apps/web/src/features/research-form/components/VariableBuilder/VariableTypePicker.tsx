'use client';

// apps/web/src/features/research-form/components/VariableBuilder/VariableTypePicker.tsx
// VariableTypePicker (REQ-FB-001): the six analysis-oriented variable kinds.
// Free text is intentionally absent — analysis-bound variables never use it.

import type { VariableType } from '@medicore/contracts';

const TYPES: Array<{ value: VariableType; label: string; hint: string }> = [
  { value: 'CONTINUOUS', label: 'Continua', hint: 'Media ± DE / mediana (RIQ). p. ej. edad, PCR.' },
  { value: 'DISCRETE', label: 'Discreta', hint: 'Nº entero. p. ej. ingresos.' },
  { value: 'DICHOTOMOUS', label: 'Dicotómica', hint: 'Sí/No (1/0). p. ej. fumador.' },
  { value: 'NOMINAL', label: 'Nominal', hint: 'Categorías sin orden. Requiere catálogo.' },
  { value: 'ORDINAL', label: 'Ordinal', hint: 'Categorías con orden. p. ej. estadio I-IV.' },
  { value: 'TIME_TO_EVENT', label: 'Tiempo a evento', hint: 'Supervivencia (tiempo + censura).' },
];

export function VariableTypePicker({ value, onChange }: { value: VariableType; onChange: (t: VariableType) => void }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-semibold text-on-surface">Tipo</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as VariableType)}
        className="w-full rounded border border-outline bg-surface px-3 py-2"
      >
        {TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label} — {t.hint}
          </option>
        ))}
      </select>
    </label>
  );
}

export default VariableTypePicker;