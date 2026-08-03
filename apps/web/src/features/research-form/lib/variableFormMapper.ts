// apps/web/src/features/research-form/lib/variableFormMapper.ts
// Pure function: StudyVariableResponse[] -> FormTemplate (REQ-FB-007).
// Mirrors the API-side variableFormMapper so the web can render the
// registration form via the shared DynamicForm contract without forking it.
// Categorical/analysis-bound variables never offer free text.

import type {
  FormField,
  FormTemplate,
  StudyVariableResponse,
} from '@medicore/contracts';

const DICHOTOMOUS_DEFAULT_OPTIONS = [
  { value: 'true', label: 'Sí' },
  { value: 'false', label: 'No' },
];

/**
 * Map a study's variables to a registration FormTemplate. Core variables
 * (isCore) never block save (doc 07 §2.2): required is forced false for them.
 */
export function variableFormMapper(
  studyId: string,
  studyName: string,
  variables: StudyVariableResponse[],
): FormTemplate {
  const fields: FormField[] = [];
  for (const v of variables) {
    const required = v.required && !v.isCore;
    switch (v.type) {
      case 'CONTINUOUS':
      case 'DISCRETE':
        fields.push({
          type: 'number',
          id: v.id,
          label: v.label,
          min: v.range?.min,
          max: v.range?.max,
          step: v.range?.step ?? 1,
          required,
        } as FormField);
        break;
      case 'DICHOTOMOUS':
        fields.push({
          type: 'select',
          id: v.id,
          label: v.label,
          options:
            v.options && v.options.length > 0
              ? v.options.map((o) => ({ value: o.value, label: o.label }))
              : DICHOTOMOUS_DEFAULT_OPTIONS,
          required,
        } as FormField);
        break;
      case 'NOMINAL':
      case 'ORDINAL':
        fields.push({
          type: 'select',
          id: v.id,
          label: v.label,
          options: (v.options ?? []).map((o) => ({ value: o.value, label: o.label })),
          required,
        } as FormField);
        break;
      case 'TIME_TO_EVENT':
        // Two-field emission for time + censoring.
        fields.push({
          type: 'number',
          id: `${v.id}.time`,
          label: `${v.label} (tiempo${v.unit ? `, ${v.unit}` : ''})`,
          min: 0,
          step: v.range?.step ?? 1,
          required,
        } as FormField);
        fields.push({
          type: 'select',
          id: `${v.id}.censored`,
          label: `${v.label} (censura)`,
          options: [
            { value: 'false', label: 'Evento' },
            { value: 'true', label: 'Censura' },
          ],
          required,
        } as FormField);
        break;
    }
  }
  if (fields.length === 0) {
    fields.push({
      type: 'text',
      id: 'placeholder',
      label: 'Sin variables configuradas',
      required: false,
    } as FormField);
  }
  return {
    id: studyId,
    name: studyName,
    specialty: 'research',
    version: '1.0.0',
    fields,
  };
}