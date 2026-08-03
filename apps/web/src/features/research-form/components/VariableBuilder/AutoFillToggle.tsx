'use client';

// apps/web/src/features/research-form/components/VariableBuilder/AutoFillToggle.tsx
// AutoFillToggle (REQ-FB-009): per-variable opt-out of EHR auto-fill. When
// enabled for a variable, linking a patient preloads it from the EHR. The
// opt-out map is persisted with the subject enrollment.

export interface AutoFillToggleProps {
  variableId: string;
  ehrPath: string | null;
  onChange: (path: string | null) => void;
}

const COMMON_EHR_PATHS = [
  { value: '', label: '— sin precarga —' },
  { value: 'patient.firstName', label: 'Nombre' },
  { value: 'patient.birthDate', label: 'Fecha nacimiento' },
  { value: 'patient.age', label: 'Edad' },
  { value: 'patient.allergies', label: 'Alergias' },
  { value: 'patient.importedData.antecedentesP', label: 'Antecedentes patológicos' },
  { value: 'patient.importedData.profesion', label: 'Profesión' },
];

export function AutoFillToggle({ ehrPath, onChange }: AutoFillToggleProps) {
  return (
    <label className="block text-xs">
      <span className="font-semibold text-on-surface">Precarga EHR (opcional)</span>
      <select
        value={ehrPath ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="mt-1 w-full rounded border border-outline bg-surface px-2 py-1"
      >
        {COMMON_EHR_PATHS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default AutoFillToggle;