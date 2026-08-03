// apps/api/src/application/research/services/variable-form-mapper.ts
// Pure function: StudyVariable[] → FormTemplate (REQ-FB-007).
// Reuses the consultations DynamicForm contract (FormTemplateSchema) without
// forking DynamicForm. The mapper renders the appropriate input control per
// variable type so categorical/analysis-bound variables never offer free text.

import { randomUUID } from 'node:crypto';
import type {
  FormField,
  FormTemplate,
} from '@medicore/contracts';
import type { StudyVariable } from '@/domain/research/study-variable.entity';

/**
 * Map a study's variables to a registration FormTemplate.
 * Mapeo (design §5):
 *  - CONTINUOUS/DISCRETE → number (with range min/max/step)
 *  - DICHOTOMOUS → select {Sí, No}
 *  - NOMINAL/ORDINAL → select (closed catalogue)
 *  - TIME_TO_EVENT → two number inputs (time + censored flag) rendered as a
 *    scale pair; for simplicity emitted as two FormFields keyed by `${id}.time`
 *    and `${id}.censored`, both required when the variable is required.
 * Core variables (isCore) never block save — rendered with required=false
 * (doc 07 §2.2).
 */
export function variableFormMapper(
  studyId: string,
  studyName: string,
  variables: StudyVariable[],
): FormTemplate {
  const fields: FormField[] = [];
  for (const v of variables) {
    const required = v.required && !v.isCore; // core never blocks save
    switch (v.type.value) {
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
            (v.options && v.options.length > 0)
              ? v.options.map((o) => ({ value: o.value, label: o.label }))
              : [
                  { value: 'true', label: 'Sí' },
                  { value: 'false', label: 'No' },
                ],
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

  // FormTemplate requires at least one field; the registration form for a
  // study with no custom variables still has the 13 fixed core variables in
  // practice, but defensively ensure non-empty when called on an empty study.
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

/** Placeholder id helper for callers that build FormTemplate ids outside studies. */
export function newFormId(): string {
  return randomUUID();
}