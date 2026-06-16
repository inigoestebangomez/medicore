// apps/api/src/domain/consultation/consultation.entity.ts
// Domain entity: Consultation — computed properties, business rules

import type { ConsultationType } from '@medicore/contracts';

export interface DiagnosisCodeEntry {
  system: 'ICD10' | 'SNOMED';
  code: string;
  description: string;
  type: 'primary' | 'secondary' | 'differential';
  notes?: string;
}

export interface ProcedureCodeEntry {
  system: 'ICD10PCS' | 'SNOMED' | 'CPT';
  code: string;
  description: string;
  laterality?: 'left' | 'right' | 'bilateral' | 'na';
  notes?: string;
}

export interface AuditLogEntry {
  action: string;
  performedBy: string;
  performedAt: Date;
  details?: string;
  /** Per-field diff entries for UPDATE actions */
  fieldDiffs?: FieldDiffEntry[];
}

export interface FieldDiffEntry {
  field: string;
  from: unknown;
  to: unknown;
  timestamp: string;
  userId: string;
}

export interface ConsultationProps {
  id: string;
  patientId: string;
  organizationId: string;
  date: Date;
  type: ConsultationType;
  physicianId: string;
  physicianName?: string | null;
  chiefComplaint: string;
  currentIllness?: string | null;
  physicalExam?: Record<string, unknown> | null;
  assessment?: string | null;
  diagnosisCodes?: DiagnosisCodeEntry[] | null;
  plan?: string | null;
  procedureCodes?: ProcedureCodeEntry[] | null;
  followUpDate?: Date | null;
  followUpNotes?: string | null;
  createdBy: string;
  updatedBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export class Consultation {
  readonly id: string;
  readonly patientId: string;
  readonly organizationId: string;
  readonly date: Date;
  readonly type: ConsultationType;
  readonly physicianId: string;
  readonly physicianName: string | null;
  readonly chiefComplaint: string;
  readonly currentIllness: string | null;
  readonly physicalExam: Record<string, unknown> | null;
  readonly assessment: string | null;
  readonly diagnosisCodes: DiagnosisCodeEntry[];
  readonly plan: string | null;
  readonly procedureCodes: ProcedureCodeEntry[];
  readonly followUpDate: Date | null;
  readonly followUpNotes: string | null;
  readonly createdBy: string;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  constructor(props: ConsultationProps) {
    this.id = props.id;
    this.patientId = props.patientId;
    this.organizationId = props.organizationId;
    this.date = props.date;
    this.type = props.type;
    this.physicianId = props.physicianId;
    this.physicianName = props.physicianName ?? null;
    this.chiefComplaint = props.chiefComplaint;
    this.currentIllness = props.currentIllness ?? null;
    this.physicalExam = (props.physicalExam as Record<string, unknown>) ?? null;
    this.assessment = props.assessment ?? null;
    this.diagnosisCodes = props.diagnosisCodes ?? [];
    this.plan = props.plan ?? null;
    this.procedureCodes = props.procedureCodes ?? [];
    this.followUpDate = props.followUpDate ?? null;
    this.followUpNotes = props.followUpNotes ?? null;
    this.createdBy = props.createdBy;
    this.updatedBy = props.updatedBy ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    this.deletedAt = props.deletedAt ?? null;
  }

  /**
   * True when a follow-up date is scheduled.
   */
  get isFollowUpScheduled(): boolean {
    return this.followUpDate !== null;
  }

  /**
   * True when at least one primary diagnosis code exists.
   */
  get hasPrimaryDiagnosis(): boolean {
    return this.diagnosisCodes.some((c) => c.type === 'primary');
  }

  /**
   * Compute the diff for an update, producing per-field audit entries.
   * Returns partial props suitable for repository update.
   */
  diffForUpdate(newProps: Partial<Omit<ConsultationProps, 'id' | 'patientId' | 'organizationId' | 'createdBy' | 'createdAt'>>, userId: string): Record<string, unknown> {
    const now = new Date().toISOString();
    const diff: Record<string, unknown> = { updatedBy: userId };
    const fieldDiffs: FieldDiffEntry[] = [];
    const trackedFields = ['date', 'type', 'chiefComplaint', 'currentIllness', 'physicalExam',
      'assessment', 'diagnosisCodes', 'plan', 'procedureCodes', 'followUpDate', 'followUpNotes'] as const;

    for (const field of trackedFields) {
      const newVal = (newProps as any)[field];
      if (newVal !== undefined) {
        diff[field] = newVal;
        const oldVal = (this as any)[field];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          fieldDiffs.push({
            field,
            from: oldVal,
            to: newVal ?? null,
            timestamp: now,
            userId,
          });
        }
      }
    }

    // Attach field diffs to audit log
    (diff as any).auditLog = {
      action: 'UPDATE',
      performedBy: userId,
      performedAt: new Date(),
      details: fieldDiffs.length > 0
        ? `Updated fields: ${fieldDiffs.map((d) => d.field).join(', ')}`
        : 'No fields changed',
      fieldDiffs: fieldDiffs.length > 0 ? fieldDiffs : undefined,
    };

    return diff;
  }

  /**
   * Soft delete: sets deletedAt to current timestamp.
   */
  softDelete(): Consultation {
    return new Consultation({ ...this, deletedAt: new Date() });
  }
}