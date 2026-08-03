// apps/api/src/domain/research/study-subject.entity.ts
// Domain entity: StudySubject — one patient's registration in a study, with
// values persisted as JSONB keyed by variableId (REQ-FB-006). Validated per
// variable type. Core variables never block save (doc 07 §2.2); empty values
// are excluded from analysis rather than rejected.

import type { StudyVariable } from './study-variable.entity';
import type { ValidationResult } from './value-objects/variable-value.vo';

export interface StudySubjectProps {
  id: string;
  organizationId: string;
  studyId: string;
  patientId?: string | null;
  patientNhc: string;
  values?: Record<string, unknown>;
  autoFillMap?: Record<string, string>;
  enrolledBy: string;
  enrolledAt?: Date;
  updatedAt?: Date;
}

export class StudySubject {
  readonly id: string;
  readonly organizationId: string;
  readonly studyId: string;
  readonly patientId: string | null;
  readonly patientNhc: string;
  readonly values: Record<string, unknown>;
  readonly autoFillMap: Record<string, string>;
  readonly enrolledBy: string;
  readonly enrolledAt: Date;
  readonly updatedAt: Date;

  constructor(props: StudySubjectProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.studyId = props.studyId;
    this.patientId = props.patientId ?? null;
    this.patientNhc = props.patientNhc;
    this.values = props.values ?? {};
    this.autoFillMap = props.autoFillMap ?? {};
    this.enrolledBy = props.enrolledBy;
    this.enrolledAt = props.enrolledAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  static create(props: {
    id: string;
    organizationId: string;
    studyId: string;
    patientId?: string | null;
    patientNhc: string;
    enrolledBy: string;
    autoFillMap?: Record<string, string>;
  }): StudySubject {
    return new StudySubject({ ...props, values: {}, enrolledAt: new Date() });
  }

  /**
   * Enroll a subject preloading core-variable values from the EHR
   * (REQ-FB-009). `autoFillMap` is a { variableId: ehrPath } snapshot; the
   * caller resolves the EHR values into `overrides` before calling.
   * Empty/missing core values are permitted (doc 07 §2.2).
   */
  enrollFromPatient(
    variables: StudyVariable[],
    overrides: Record<string, unknown>,
  ): StudySubject {
    const values: Record<string, unknown> = {};
    for (const v of variables) {
      if (v.autoFillApplies(this.autoFillMap) && overrides[v.id] !== undefined) {
        values[v.id] = overrides[v.id];
      }
    }
    return this.clone({ values, updatedAt: new Date() });
  }

  /**
   * Set a single variable value, validating against the variable's type.
   * Returns the updated subject and the validation result so the handler can
   * translate a failure into a 400 (REQ-FB-006 "valor fuera de catálogo").
   */
  setValue(variable: StudyVariable, raw: unknown): {
    subject: StudySubject;
    result: ValidationResult;
  } {
    const result = variable.validateValue(raw);
    if (!result.ok) return { subject: this, result };
    const values = { ...this.values, [variable.id]: raw };
    return { subject: this.clone({ values, updatedAt: new Date() }), result };
  }

  getValue(varId: string): unknown {
    return this.values[varId];
  }

  /**
   * Validate all present values against their variables (REQ-FB-006).
   * Empty values are skipped (núcleo fijo rule) — never error.
   * Returns a list of { variableId, error } for non-empty invalid values.
   */
  validate(variables: StudyVariable[]): { variableId: string; error: string }[] {
    const byId = new Map(variables.map((v) => [v.id, v]));
    const errors: { variableId: string; error: string }[] = [];
    for (const [varId, raw] of Object.entries(this.values)) {
      const v = byId.get(varId);
      if (!v) continue; // unknown variable id — ignore (deleted variables stay in JSONB)
      const r = v.validateValue(raw);
      if (!r.ok) errors.push({ variableId: varId, error: r.error });
    }
    return errors;
  }

  /** Variables with a non-empty value present (used to scope analysis). */
  presentVariables(): string[] {
    return Object.keys(this.values).filter((k) => {
      const v = this.values[k];
      return v !== undefined && v !== null && v !== '';
    });
  }

  private clone(overrides: Partial<StudySubjectProps>): StudySubject {
    return new StudySubject({
      id: this.id,
      organizationId: this.organizationId,
      studyId: this.studyId,
      patientId: this.patientId,
      patientNhc: this.patientNhc,
      values: this.values,
      autoFillMap: this.autoFillMap,
      enrolledBy: this.enrolledBy,
      enrolledAt: this.enrolledAt,
      updatedAt: this.updatedAt,
      ...overrides,
    });
  }
}