// apps/api/src/domain/clinical-record/diagnosis/diagnosis.entity.ts
// Domain entity: Diagnosis — first-class entity with status lifecycle.
// Spec §6: CIE-10-ES/SNOMED codes, active/resolved/discarded state, clinical variables.

export type DiagnosisCodeSystem = 'CIE-10-ES' | 'SNOMED';
export type DiagnosisStatus = 'ACTIVE' | 'RESOLVED' | 'DISCARDED';

export interface DiagnosisProps {
  id: string;
  organizationId: string;
  patientId: string;
  system: DiagnosisCodeSystem;
  code: string;
  description: string;
  catalogVersion: string;
  status: DiagnosisStatus;
  variables: Record<string, string | number | boolean>;
  consultationId?: string | null;
  sourceType: string;
  authorId: string;
  recordedAt: Date;
  resolvedAt?: Date | null;
  discardedAt?: Date | null;
  discardedBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Diagnosis {
  readonly id: string;
  readonly organizationId: string;
  readonly patientId: string;
  readonly system: DiagnosisCodeSystem;
  readonly code: string;
  readonly description: string;
  readonly catalogVersion: string;
  readonly status: DiagnosisStatus;
  readonly variables: Record<string, string | number | boolean>;
  readonly consultationId: string | null;
  readonly sourceType: string;
  readonly authorId: string;
  readonly recordedAt: Date;
  readonly resolvedAt: Date | null;
  readonly discardedAt: Date | null;
  readonly discardedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: DiagnosisProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.patientId = props.patientId;
    this.system = props.system;
    this.code = props.code;
    this.description = props.description;
    this.catalogVersion = props.catalogVersion;
    this.status = props.status;
    this.variables = props.variables;
    this.consultationId = props.consultationId ?? null;
    this.sourceType = props.sourceType;
    this.authorId = props.authorId;
    this.recordedAt = props.recordedAt;
    this.resolvedAt = props.resolvedAt ?? null;
    this.discardedAt = props.discardedAt ?? null;
    this.discardedBy = props.discardedBy ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  /**
   * Whether this diagnosis is included in active statistics (spec §6).
   * Discarded diagnoses are excluded from active stats but retained for audit.
   */
  get isActive(): boolean {
    return this.status === 'ACTIVE';
  }

  /**
   * Resolve this diagnosis — transitions from ACTIVE to RESOLVED.
   * Returns a new Diagnosis (immutable).
   */
  resolve(): Diagnosis {
    if (this.status !== 'ACTIVE') {
      throw new Error(`Cannot resolve diagnosis with status ${this.status}`);
    }
    return new Diagnosis({
      ...this,
      status: 'RESOLVED',
      resolvedAt: new Date(),
    });
  }

  /**
   * Discard this diagnosis — transitions from ACTIVE to DISCARDED.
   * Discarded diagnoses remain for audit but are excluded from active stats (spec §6).
   * Returns a new Diagnosis (immutable).
   */
  discard(discardedBy: string): Diagnosis {
    if (this.status !== 'ACTIVE') {
      throw new Error(`Cannot discard diagnosis with status ${this.status}`);
    }
    return new Diagnosis({
      ...this,
      status: 'DISCARDED',
      discardedAt: new Date(),
      discardedBy,
    });
  }
}
