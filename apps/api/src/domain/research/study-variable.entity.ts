// apps/api/src/domain/research/study-variable.entity.ts
// Domain entity: StudyVariable — analysis-oriented variable definition owned by
// a ResearchStudy (REQ-FB-001). Variables are NOT UI-oriented; the mapping to
// FormField happens only at registration time (variableFormMapper).

import { VariableTypeVO } from './value-objects/variable-type.vo';
import { VariableScopeVO } from './value-objects/variable-scope.vo';
import {
  validateVariableValue,
  type ValidationResult,
  type VariableOptionDef,
  type VariableRangeDef,
} from './value-objects/variable-value.vo';

export interface StudyVariableProps {
  id: string;
  organizationId: string;
  studyId: string;
  name: string;
  label: string;
  type: string;
  scope?: string;
  unit?: string | null;
  required?: boolean;
  isCore?: boolean;
  position?: number;
  options?: VariableOptionDef[] | null;
  range?: VariableRangeDef | null;
  parentId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class StudyVariable {
  readonly id: string;
  readonly organizationId: string;
  readonly studyId: string;
  readonly name: string;
  readonly label: string;
  readonly type: VariableTypeVO;
  readonly scope: VariableScopeVO;
  readonly unit: string | null;
  readonly required: boolean;
  readonly isCore: boolean;
  readonly position: number;
  readonly options: VariableOptionDef[] | null;
  readonly range: VariableRangeDef | null;
  readonly parentId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: StudyVariableProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.studyId = props.studyId;
    this.name = props.name;
    this.label = props.label;
    this.type = VariableTypeVO.create(props.type);
    this.scope = VariableScopeVO.create(props.scope ?? 'CUSTOM');
    this.unit = props.unit ?? null;
    this.required = props.required ?? false;
    this.isCore = props.isCore ?? false;
    this.position = props.position ?? 0;
    this.options = props.options ?? null;
    this.range = props.range ?? null;
    this.parentId = props.parentId ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  static create(props: {
    id: string;
    organizationId: string;
    studyId: string;
    name: string;
    label: string;
    type: string;
    scope?: string;
    unit?: string | null;
    required?: boolean;
    isCore?: boolean;
    position?: number;
    options?: VariableOptionDef[] | null;
    range?: VariableRangeDef | null;
    parentId?: string | null;
  }): StudyVariable {
    return new StudyVariable(props);
  }

  /**
   * Validate a raw input value against this variable's type/metadata.
   * REQ-FB-001 / REQ-FB-006.
   */
  validateValue(raw: unknown): ValidationResult {
    // Catalogue presence invariant for NOMINAL/ORDINAL (REQ-FB-001 scenario).
    if (this.type.requiresOptions && (!this.options || this.options.length === 0)) {
      return { ok: false, error: 'no_options_defined' };
    }
    return validateVariableValue({
      type: this.type.value,
      raw,
      options: this.options,
      range: this.range,
      required: this.required,
    });
  }

  /** Move the variable to a new position (REQ-FB-004: reordering). */
  reorder(newPosition: number): StudyVariable {
    return this.clone({ position: Math.max(0, newPosition | 0), updatedAt: new Date() });
  }

  /**
   * Whether this variable should be auto-filled from the EHR for a given
   * subject (REQ-FB-009). A variable qualifies when its id appears in the
   * subject's autoFillMap and the study hasn't opted the field out.
   */
  autoFillApplies(autoFillMap: Record<string, string>): boolean {
    return Object.prototype.hasOwnProperty.call(autoFillMap, this.id);
  }

  /** Update mutable metadata (label/unit/options/range/required/isCore). */
  update(props: Partial<StudyVariableProps>): StudyVariable {
    return this.clone({ ...props, updatedAt: new Date() });
  }

  /**
   * Decompose a composite variable into N DICHOTOMOUS child variables
   * (REQ-FB-005). The parent keeps its identity; each child carries parentId.
   * Returns new child entities (caller persists them as a batch).
   */
  decompose(children: { name: string; label: string }[]): StudyVariable[] {
    return children.map((c, i) =>
      StudyVariable.create({
        id: crypto.randomUUID(),
        organizationId: this.organizationId,
        studyId: this.studyId,
        name: c.name,
        label: c.label,
        type: 'DICHOTOMOUS',
        scope: 'CUSTOM',
        options: [
          { value: 'true', label: 'Sí' },
          { value: 'false', label: 'No' },
        ],
        parentId: this.id,
        position: this.position + 1 + i,
      }),
    );
  }

  /**
   * Map this variable to a UI FormField definition (pure — used by
   * variableFormMapper at registration time). The mapping keeps the variable
   * analysis-oriented while rendering the appropriate input control.
   * Mapeo: CONTINUOUS/DISCRETE → number; DICHOTOMOUS → select {Sí,No};
   * NOMINAL/ORDINAL → select (options); TIME_TO_EVENT → 2 inputs (handled by mapper).
   */
  toFormField(): Record<string, unknown> {
    const base = { id: this.id, label: this.label, required: this.required };
    switch (this.type.value) {
      case 'CONTINUOUS':
      case 'DISCRETE':
        return {
          ...base,
          type: 'number',
          min: this.range?.min,
          max: this.range?.max,
          step: this.range?.step ?? 1,
        };
      case 'DICHOTOMOUS':
        return {
          ...base,
          type: 'select',
          options: this.options ?? [
            { value: 'true', label: 'Sí' },
            { value: 'false', label: 'No' },
          ],
        };
      case 'NOMINAL':
      case 'ORDINAL':
        return { ...base, type: 'select', options: this.options ?? [] };
      case 'TIME_TO_EVENT':
        // TIME_TO_EVENT renders as two number inputs (time + censored flag);
        // the mapper splits this into the registration form.
        return { ...base, type: 'time_to_event', unit: this.unit };
      default:
        return { ...base, type: 'text' };
    }
  }

  private clone(overrides: Partial<StudyVariableProps>): StudyVariable {
    return new StudyVariable({
      id: this.id,
      organizationId: this.organizationId,
      studyId: this.studyId,
      name: this.name,
      label: this.label,
      type: this.type.value,
      scope: this.scope.value,
      unit: this.unit,
      required: this.required,
      isCore: this.isCore,
      position: this.position,
      options: this.options,
      range: this.range,
      parentId: this.parentId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      ...overrides,
    });
  }
}