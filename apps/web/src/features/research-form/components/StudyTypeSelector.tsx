'use client';

// apps/web/src/features/research-form/components/StudyTypeSelector.tsx
// StudyTypeSelector (REQ-FB-008): choose QUERY (V3 cohort from a saved
// research query), FORM (pure form-based data capture) or HYBRID (query
// cohort + custom form variables). Feature-flagged by RESEARCH_FORM_BUILDER.

import type { StudyType } from '@medicore/contracts';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

export interface StudyTypeSelectorProps {
  value: StudyType;
  onChange: (t: StudyType) => void;
}

const OPTIONS: Array<{ type: StudyType; title: string; description: string }> = [
  { type: 'QUERY', title: 'Query', description: 'Cohorte generada desde una consulta guardada del EHR (V3).' },
  { type: 'FORM', title: 'Formulario', description: 'Captura de datos por formulario con variables configurables. Sin consulta.' },
  { type: 'HYBRID', title: 'Híbrido', description: 'Cohorte de una consulta + variables de formulario personalizadas.' },
];

export function StudyTypeSelector({ value, onChange }: StudyTypeSelectorProps) {
  const formBuilderEnabled = useFeatureFlag('RESEARCH_FORM_BUILDER');
  const selectable = formBuilderEnabled ? OPTIONS : OPTIONS.filter((o) => o.type === 'QUERY');

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-on-surface">Tipo de estudio</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {selectable.map((o) => {
          const selected = value === o.type;
          const disabled = o.type !== 'QUERY' && !formBuilderEnabled;
          return (
            <button
              key={o.type}
              type="button"
              disabled={disabled}
              onClick={() => onChange(o.type as StudyType)}
              aria-pressed={selected}
              className={`rounded-lg border p-3 text-left transition ${
                selected ? 'border-primary bg-primary/10' : 'border-outline bg-surface hover:bg-surface-low'
              } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <div className="text-sm font-semibold text-on-surface">{o.title}</div>
              <div className="mt-1 text-xs text-on-surface-variant">{o.description}</div>
            </button>
          );
        })}
      </div>
      {!formBuilderEnabled && (
        <p className="text-xs text-on-surface-variant">
          El constructor de formularios está desactivado en esta organización. Solo disponibles los estudios Query.
        </p>
      )}
    </fieldset>
  );
}

export default StudyTypeSelector;