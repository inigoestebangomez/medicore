// apps/api/src/domain/medication/medication.entity.ts
// Domain entity: MedicationPrescription — state machine, soft delete, diff audit

import type { MedicationStatus } from '@medicore/contracts';
import type { AuditLogEntry, FieldDiffEntry } from '../consultation/consultation.entity';
import { InvalidMedicationTransitionError } from './errors/invalid-medication-transition.error';
import { MissingDiscontinuationReasonError } from './errors/missing-discontinuation-reason.error';

export interface MedicationProps {
  id: string;
  organizationId: string;
  patientId: string;
  consultationId?: string | null;
  physicianId: string;
  drugName: string;
  drugCode?: string | null;
  activeIngredient?: string | null;
  dosage: string;
  frequency: string;
  route?: string | null;
  form?: string | null;
  startDate: Date;
  endDate?: Date | null;
  duration?: string | null;
  status: MedicationStatus;
  instructions?: string | null;
  reason?: string | null;
  discontinuationReason?: string | null;
  createdBy: string;
  updatedBy?: string | null;
  auditLog?: AuditLogEntry[] | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export class Medication {
  readonly id: string;
  readonly organizationId: string;
  readonly patientId: string;
  readonly consultationId: string | null;
  readonly physicianId: string;
  readonly drugName: string;
  readonly drugCode: string | null;
  readonly activeIngredient: string | null;
  readonly dosage: string;
  readonly frequency: string;
  readonly route: string | null;
  readonly form: string | null;
  readonly startDate: Date;
  readonly endDate: Date | null;
  readonly duration: string | null;
  readonly status: MedicationStatus;
  readonly instructions: string | null;
  readonly reason: string | null;
  readonly discontinuationReason: string | null;
  readonly createdBy: string;
  readonly updatedBy: string | null;
  readonly auditLog: AuditLogEntry[] | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  /** Allowed state transitions for the MedicationPrescription status state machine. */
  // BR-MED-001: State machine — ACTIVE can go to DISCONTINUED, COMPLETED, ON_HOLD
  // ON_HOLD can go to ACTIVE or DISCONTINUED
  // DISCONTINUED and COMPLETED are terminal states
  static readonly ALLOWED_TRANSITIONS: Record<MedicationStatus, MedicationStatus[]> = {
    ACTIVE: ['DISCONTINUED', 'COMPLETED', 'ON_HOLD'],
    ON_HOLD: ['ACTIVE', 'DISCONTINUED'],
    DISCONTINUED: [],
    COMPLETED: [],
  };

  constructor(props: MedicationProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.patientId = props.patientId;
    this.consultationId = props.consultationId ?? null;
    this.physicianId = props.physicianId;
    this.drugName = props.drugName;
    this.drugCode = props.drugCode ?? null;
    this.activeIngredient = props.activeIngredient ?? null;
    this.dosage = props.dosage;
    this.frequency = props.frequency;
    this.route = props.route ?? null;
    this.form = props.form ?? null;
    this.startDate = props.startDate;
    this.endDate = props.endDate ?? null;
    this.duration = props.duration ?? null;
    this.status = props.status;
    this.instructions = props.instructions ?? null;
    this.reason = props.reason ?? null;
    this.discontinuationReason = props.discontinuationReason ?? null;
    this.createdBy = props.createdBy;
    this.updatedBy = props.updatedBy ?? null;
    this.auditLog = props.auditLog ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    this.deletedAt = props.deletedAt ?? null;
  }

  /**
   * Whether this medication can transition to the given target status.
   */
  canTransitionTo(target: MedicationStatus): boolean {
    return Medication.ALLOWED_TRANSITIONS[this.status]?.includes(target) ?? false;
  }

  /**
   * Whether this medication is in a terminal state (DISCONTINUED or COMPLETED).
   */
  isTerminal(): boolean {
    return this.status === 'DISCONTINUED' || this.status === 'COMPLETED';
  }

  /**
   * Transition to a new status. Returns a new Medication instance.
   * Throws InvalidMedicationTransitionError if the transition is not allowed.
   * BR-MED-003: Discontinuation requires a reason
   */
  transitionTo(target: MedicationStatus, reason?: string): Medication {
    if (!this.canTransitionTo(target)) {
      throw new InvalidMedicationTransitionError(this.status, target);
    }

    // BR-MED-003: Discontinuation requires a reason
    if (target === 'DISCONTINUED' && !reason) {
      throw new MissingDiscontinuationReasonError();
    }

    return new Medication({
      ...this,
      status: target,
      discontinuationReason: target === 'DISCONTINUED' ? reason : this.discontinuationReason,
      updatedAt: new Date(),
    });
  }

  /**
   * Compute the diff for an update, producing per-field audit entries.
   */
  diffForUpdate(
    newProps: Partial<Omit<MedicationProps, 'id' | 'organizationId' | 'patientId' | 'createdBy' | 'createdAt'>>,
    userId: string,
  ): AuditLogEntry[] {
    const now = new Date().toISOString();
    const fieldDiffs: FieldDiffEntry[] = [];
    const trackedFields = [
      'drugName', 'drugCode', 'activeIngredient', 'dosage', 'frequency',
      'route', 'form', 'startDate', 'endDate', 'duration',
      'instructions', 'reason', 'status', 'discontinuationReason',
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
  softDelete(): Medication {
    return new Medication({ ...this, deletedAt: new Date() });
  }
}