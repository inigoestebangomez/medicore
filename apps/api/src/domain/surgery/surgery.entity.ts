// apps/api/src/domain/surgery/surgery.entity.ts
// Domain entity: Surgery — state machine, computed properties, business rules

import type { SurgeryStatus, AsaClassification } from '@medicore/contracts';
import type { AuditLogEntry, FieldDiffEntry } from '../consultation/consultation.entity';
import { InvalidSurgeryTransitionError } from './errors/invalid-surgery-transition.error';

export interface SurgeryProps {
  id: string;
  organizationId: string;
  patientId: string;
  physicianId: string;
  date: Date;
  status: SurgeryStatus;
  procedureType: string;
  procedureCodes?: any[] | null;
  asa?: AsaClassification | null;
  anesthesiaType?: string | null;
  preOpNotes?: string | null;
  preOpChecklist?: Record<string, unknown> | null;
  duration?: number | null;
  technique?: Record<string, unknown> | null;
  findings?: string | null;
  complications?: string | null;
  postOpNotes?: string | null;
  postOpProtocol?: Record<string, unknown> | null;
  outcome?: string | null;
  editReason?: string | null;
  createdBy: string;
  updatedBy?: string | null;
  auditLog?: AuditLogEntry[] | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export class Surgery {
  readonly id: string;
  readonly organizationId: string;
  readonly patientId: string;
  readonly physicianId: string;
  readonly date: Date;
  readonly status: SurgeryStatus;
  readonly procedureType: string;
  readonly procedureCodes: any[] | null;
  readonly asa: AsaClassification | null;
  readonly anesthesiaType: string | null;
  readonly preOpNotes: string | null;
  readonly preOpChecklist: Record<string, unknown> | null;
  readonly duration: number | null;
  readonly technique: Record<string, unknown> | null;
  readonly findings: string | null;
  readonly complications: string | null;
  readonly postOpNotes: string | null;
  readonly postOpProtocol: Record<string, unknown> | null;
  readonly outcome: string | null;
  readonly editReason: string | null;
  readonly createdBy: string;
  readonly updatedBy: string | null;
  readonly auditLog: AuditLogEntry[] | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  /** Allowed state transitions for the Surgery status state machine. */
  static readonly ALLOWED_TRANSITIONS: Record<SurgeryStatus, SurgeryStatus[]> = {
    SCHEDULED: ['COMPLETED', 'CANCELLED', 'POSTPONED'],
    POSTPONED: ['SCHEDULED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  };

  constructor(props: SurgeryProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.patientId = props.patientId;
    this.physicianId = props.physicianId;
    this.date = props.date;
    this.status = props.status;
    this.procedureType = props.procedureType;
    this.procedureCodes = props.procedureCodes ?? null;
    this.asa = props.asa ?? null;
    this.anesthesiaType = props.anesthesiaType ?? null;
    this.preOpNotes = props.preOpNotes ?? null;
    this.preOpChecklist = (props.preOpChecklist as Record<string, unknown>) ?? null;
    this.duration = props.duration ?? null;
    this.technique = (props.technique as Record<string, unknown>) ?? null;
    this.findings = props.findings ?? null;
    this.complications = props.complications ?? null;
    this.postOpNotes = props.postOpNotes ?? null;
    this.postOpProtocol = (props.postOpProtocol as Record<string, unknown>) ?? null;
    this.outcome = props.outcome ?? null;
    this.editReason = props.editReason ?? null;
    this.createdBy = props.createdBy;
    this.updatedBy = props.updatedBy ?? null;
    this.auditLog = props.auditLog ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    this.deletedAt = props.deletedAt ?? null;
  }

  /**
   * Whether this surgery can transition to the given target status.
   */
  canTransitionTo(target: SurgeryStatus): boolean {
    return Surgery.ALLOWED_TRANSITIONS[this.status]?.includes(target) ?? false;
  }

  /**
   * Whether this surgery is in a terminal state (COMPLETED or CANCELLED).
   */
  isTerminal(): boolean {
    return this.status === 'COMPLETED' || this.status === 'CANCELLED';
  }

  /**
   * Transition to a new status. Returns a new Surgery instance.
   * Throws InvalidSurgeryTransitionError if the transition is not allowed.
   */
  transitionTo(target: SurgeryStatus, date?: Date, asa?: AsaClassification, reason?: string): Surgery {
    if (!this.canTransitionTo(target)) {
      throw new InvalidSurgeryTransitionError(this.status, target);
    }

    return new Surgery({
      ...this,
      status: target,
      date: date ?? this.date,
      asa: asa ?? this.asa,
      editReason: reason ?? null,
      updatedAt: new Date(),
    });
  }

  /**
   * Compute the diff for an update, producing per-field audit entries.
   * For terminal state edits, editReason is included in audit.
   */
  diffForUpdate(newProps: Partial<Omit<SurgeryProps, 'id' | 'organizationId' | 'patientId' | 'createdBy' | 'createdAt'>>, userId: string): AuditLogEntry[] {
    const now = new Date().toISOString();
    const fieldDiffs: FieldDiffEntry[] = [];
    const trackedFields = [
      'date', 'procedureType', 'procedureCodes', 'asa', 'anesthesiaType',
      'preOpNotes', 'preOpChecklist', 'duration', 'technique', 'findings',
      'complications', 'postOpNotes', 'postOpProtocol', 'outcome', 'editReason',
    ] as const;

    for (const field of trackedFields) {
      const newVal = (newProps as any)[field];
      if (newVal !== undefined) {
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

    const details = fieldDiffs.length > 0
      ? `Updated fields: ${fieldDiffs.map((d) => d.field).join(', ')}`
      : 'No fields changed';

    const entry: AuditLogEntry = {
      action: 'UPDATE',
      performedBy: userId,
      performedAt: new Date(),
      details,
      fieldDiffs: fieldDiffs.length > 0 ? fieldDiffs : undefined,
    };

    return [entry];
  }

  /**
   * Soft delete: sets deletedAt to current timestamp.
   */
  softDelete(): Surgery {
    return new Surgery({ ...this, deletedAt: new Date() });
  }
}