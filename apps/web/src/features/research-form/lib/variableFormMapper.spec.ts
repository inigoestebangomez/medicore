// apps/web/src/features/research-form/lib/variableFormMapper.spec.ts
// Contract test (6.6): the web variableFormMapper MUST produce a FormTemplate
// that validates against the shared FormTemplateSchema — the same contract the
// consultations DynamicForm consumes (REQ-FB-007). No free text for
// analysis-bound categoricals.

import { describe, it, expect } from 'vitest';
import { FormTemplateSchema } from '@medicore/contracts';
import type { StudyVariableResponse } from '@medicore/contracts';
import { variableFormMapper } from './variableFormMapper';

function var_<K extends StudyVariableResponse['type']>(
  id: string,
  type: K,
  overrides: Partial<StudyVariableResponse> = {},
): StudyVariableResponse {
  return {
    id,
    organizationId: 'o',
    studyId: 's',
    name: id,
    label: id,
    type,
    scope: 'CUSTOM',
    unit: null,
    required: false,
    isCore: false,
    position: 0,
    options: null,
    range: null,
    parentId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as StudyVariableResponse;
}

describe('variableFormMapper (REQ-FB-007) — contract compliance', () => {
  it('maps a CONTINUOUS variable to a number field with range', () => {
    const t = variableFormMapper('s', 'Edad', [
      var_('v1', 'CONTINUOUS', { label: 'Edad', range: { min: 0, max: 120, step: 1 } }),
    ]);
    const parsed = FormTemplateSchema.parse(t);
    expect(parsed.fields).toHaveLength(1);
    expect(parsed.fields[0].type).toBe('number');
  });

  it('maps a DICHOTOMOUS variable to a select with default {Sí,No}', () => {
    const t = variableFormMapper('s', 'Fum', [var_('v2', 'DICHOTOMOUS', { label: 'Fumador' })]);
    const parsed = FormTemplateSchema.parse(t);
    const f = parsed.fields[0];
    expect(f.type).toBe('select');
    if (f.type === 'select') {
      const values = (f.options as Array<{ value: string }>).map((o) => o.value);
      expect(values).toEqual(['true', 'false']);
    }
  });

  it('maps NOMINAL to a closed-catalogue select (never free text)', () => {
    const t = variableFormMapper('s', 'GS', [
      var_('v3', 'NOMINAL', {
        label: 'Grupo',
        options: [
          { value: 'A', label: 'A' },
          { value: 'B', label: 'B' },
        ],
      }),
    ]);
    const parsed = FormTemplateSchema.parse(t);
    expect(parsed.fields[0].type).toBe('select');
  });

  it('maps TIME_TO_EVENT to two fields (time + censored)', () => {
    const t = variableFormMapper('s', 'Sup', [var_('v4', 'TIME_TO_EVENT', { label: 'Supervivencia', unit: 'días' })]);
    const parsed = FormTemplateSchema.parse(t);
    expect(parsed.fields).toHaveLength(2);
    expect(parsed.fields[0].type).toBe('number');
    expect(parsed.fields[1].type).toBe('select');
  });

  it('forces required=false for core variables (núcleo fijo never blocks save)', () => {
    const t = variableFormMapper('s', 'Core', [
      var_('core', 'CONTINUOUS', { label: 'Edad', isCore: true, required: true, range: { min: 0, max: 120, step: 1 } }),
    ]);
    const parsed = FormTemplateSchema.parse(t);
    if (parsed.fields[0].type === 'number') expect(parsed.fields[0].required).toBe(false);
  });

  it('emits a valid placeholder template when no variables are configured', () => {
    const t = variableFormMapper('s', 'Empty', []);
    const parsed = FormTemplateSchema.parse(t);
    expect(parsed.fields).toHaveLength(1);
    expect(parsed.fields[0].type).toBe('text');
  });

  it('maps all six variable types together and still validates', () => {
    const vars: StudyVariableResponse[] = [
      var_('c1', 'CONTINUOUS', { range: { min: 0, max: 100, step: 1 } }),
      var_('c2', 'DISCRETE'),
      var_('c3', 'DICHOTOMOUS'),
      var_('c4', 'NOMINAL', { options: [{ value: 'x', label: 'X' }] }),
      var_('c5', 'ORDINAL', { options: [{ value: '1', label: 'Bajo' }, { value: '2', label: 'Alto' }] }),
      var_('c6', 'TIME_TO_EVENT', { unit: 'meses', range: { step: 1 } }),
    ];
    const t = variableFormMapper('s', 'Full', vars);
    // CONTINUOUS+DISCRETE+DICHOTOMOUS+NOMINAL+ORDINAL = 5 fields + TIME_TO_EVENT 2 = 7
    expect(FormTemplateSchema.safeParse(t).success).toBe(true);
    expect(t.fields).toHaveLength(7);
  });
});