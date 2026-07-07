// apps/api/src/domain/scale/clinical-scale.entity.ts
// Domain entity: ClinicalScale — server-side total, soft delete, diff audit

import type { ClinicalScaleType } from '@medicore/contracts';
import type { AuditLogEntry, FieldDiffEntry } from '../consultation/consultation.entity';
import { calculateTotal } from './value-objects/scale-calculator';

export interface ClinicalScaleProps {
  id: string;
  organizationId: string;
  patientId: string;
  consultationId?: string | null;
  scaleType: ClinicalScaleType;
  date: Date;
  scores: Record<string, number>;
  total?: number;
  notes?: string | null;
  createdBy: string;
  updatedBy?: string | null;
  auditLog?: AuditLogEntry[] | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export class ClinicalScale {
  readonly id: string;
  readonly organizationId: string;
  readonly patientId: string;
  readonly consultationId: string | null;
  readonly scaleType: ClinicalScaleType;
  readonly date: Date;
  readonly scores: Record<string, number>;
  readonly total: number;
  readonly notes: string | null;
  readonly createdBy: string;
  readonly updatedBy: string | null;
  readonly auditLog: AuditLogEntry[] | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  constructor(props: ClinicalScaleProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.patientId = props.patientId;
    this.consultationId = props.consultationId ?? null;
    this.scaleType = props.scaleType;
    this.date = props.date;
    this.scores = props.scores;
    // BR-SCA-002: Server-side total recalculation — never trust client-sent total
    this.total = props.total ?? calculateTotal(props.scaleType, props.scores);
    this.notes = props.notes ?? null;
    this.createdBy = props.createdBy;
    this.updatedBy = props.updatedBy ?? null;
    this.auditLog = props.auditLog ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    this.deletedAt = props.deletedAt ?? null;
  }

  /**
   * Compute the diff for an update, producing per-field audit entries.
   */
  diffForUpdate(
    newProps: Partial<Omit<ClinicalScaleProps, 'id' | 'organizationId' | 'patientId' | 'createdBy' | 'createdAt'>>,
    userId: string,
  ): AuditLogEntry[] {
    const now = new Date().toISOString();
    const fieldDiffs: FieldDiffEntry[] = [];
    const trackedFields = ['scores', 'notes'] as const;

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
  softDelete(): ClinicalScale {
    return new ClinicalScale({ ...this, deletedAt: new Date() });
  }
}