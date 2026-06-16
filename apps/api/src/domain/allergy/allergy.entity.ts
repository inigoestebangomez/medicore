// apps/api/src/domain/allergy/allergy.entity.ts
import type { AllergySeverity, AllergyStatus } from '@medicore/contracts';

export interface AllergyProps {
  id: string;
  organizationId: string;
  patientId: string;
  substance: string;
  substanceCode?: string | null;
  reaction?: string | null;
  severity: AllergySeverity;
  status: AllergyStatus;
  onsetDate?: Date | null;
  notes?: string | null;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export class Allergy {
  readonly id: string;
  readonly organizationId: string;
  readonly patientId: string;
  readonly substance: string;
  readonly substanceCode: string | null;
  readonly reaction: string | null;
  readonly severity: AllergySeverity;
  readonly status: AllergyStatus;
  readonly onsetDate: Date | null;
  readonly notes: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  constructor(props: AllergyProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.patientId = props.patientId;
    this.substance = props.substance;
    this.substanceCode = props.substanceCode ?? null;
    this.reaction = props.reaction ?? null;
    this.severity = props.severity;
    this.status = props.status;
    this.onsetDate = props.onsetDate ?? null;
    this.notes = props.notes ?? null;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    this.deletedAt = props.deletedAt ?? null;
  }

  /** BR-PAT-006: ANAPHYLAXIS severity triggers critical flag */
  get isCritical(): boolean {
    return this.severity === 'ANAPHYLAXIS' && this.status === 'ACTIVE';
  }

  get isActive(): boolean {
    return this.status === 'ACTIVE';
  }

  softDelete(): Allergy {
    return new Allergy({ ...this, deletedAt: new Date() });
  }
}