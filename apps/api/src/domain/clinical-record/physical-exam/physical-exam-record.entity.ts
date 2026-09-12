// apps/api/src/domain/clinical-record/physical-exam/physical-exam-record.entity.ts
// Domain entity: PhysicalExamRecord — pins template version + schema snapshot.
// Spec §4: existing examinations remain interpretable after template changes.

import type { ReviewState } from '@medicore/contracts';
import type { ExamTemplateField } from './physical-exam-template.entity';

export interface CustomFinding {
  label: string;
  value: string;
}

export interface PhysicalExamRecordProps {
  id: string;
  organizationId: string;
  patientId: string;
  templateId: string;
  templateVersion: number;
  templateSchemaSnapshot: ExamTemplateField[];
  values: Record<string, string | number | boolean>;
  customFindings: CustomFinding[];
  consultationId?: string | null;
  sourceType: string;
  authorId: string;
  recordedAt: Date;
  reviewState: ReviewState;
  createdAt?: Date;
}

export class PhysicalExamRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly patientId: string;
  readonly templateId: string;
  readonly templateVersion: number;
  readonly templateSchemaSnapshot: ExamTemplateField[];
  readonly values: Record<string, string | number | boolean>;
  readonly customFindings: CustomFinding[];
  readonly consultationId: string | null;
  readonly sourceType: string;
  readonly authorId: string;
  readonly recordedAt: Date;
  readonly reviewState: ReviewState;
  readonly createdAt: Date;

  constructor(props: PhysicalExamRecordProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.patientId = props.patientId;
    this.templateId = props.templateId;
    this.templateVersion = props.templateVersion;
    this.templateSchemaSnapshot = props.templateSchemaSnapshot;
    this.values = props.values;
    this.customFindings = props.customFindings;
    this.consultationId = props.consultationId ?? null;
    this.sourceType = props.sourceType;
    this.authorId = props.authorId;
    this.recordedAt = props.recordedAt;
    this.reviewState = props.reviewState;
    this.createdAt = props.createdAt ?? new Date();
  }

  /**
   * Get a value by field key from the pinned snapshot.
   * Uses the snapshot schema — not the current template — so historical records
   * remain interpretable even after template changes (spec §4).
   */
  getValue(fieldKey: string): string | number | boolean | undefined {
    return this.values[fieldKey];
  }

  /**
   * Returns the field definition from the pinned snapshot.
   */
  getSnapshotField(key: string): ExamTemplateField | undefined {
    return this.templateSchemaSnapshot.find((f) => f.key === key);
  }

  /**
   * Whether this exam has any custom (non-template) findings.
   */
  get hasCustomFindings(): boolean {
    return this.customFindings.length > 0;
  }
}
