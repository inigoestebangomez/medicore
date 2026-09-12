// apps/api/src/domain/clinical-record/lab/lab-report.entity.ts
// Domain entity: LabReport — PDF in private S3, OCR output starts UNREVIEWED.
// Spec §5: only CONFIRMED values become clinical data; OCR provenance remains visible.

import type { ReviewState } from '@medicore/contracts';

export interface LabResultItem {
  name: string;
  value: string;
  unit?: string;
  referenceRange?: string;
}

export interface LabReportProps {
  id: string;
  organizationId: string;
  patientId: string;
  s3Key: string;
  fileName: string;
  ocrPayload?: unknown | null;
  overallReviewState: ReviewState;
  results: LabResult[];
  sourceType: string;
  authorId: string;
  recordedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class LabReport {
  readonly id: string;
  readonly organizationId: string;
  readonly patientId: string;
  readonly s3Key: string;
  readonly fileName: string;
  readonly ocrPayload: unknown | null;
  readonly overallReviewState: ReviewState;
  readonly results: LabResult[];
  readonly sourceType: string;
  readonly authorId: string;
  readonly recordedAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: LabReportProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.patientId = props.patientId;
    this.s3Key = props.s3Key;
    this.fileName = props.fileName;
    this.ocrPayload = props.ocrPayload ?? null;
    this.overallReviewState = props.overallReviewState;
    this.results = props.results;
    this.sourceType = props.sourceType;
    this.authorId = props.authorId;
    this.recordedAt = props.recordedAt;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  /**
   * Only CONFIRMED results are clinical data (spec §5).
   */
  get confirmedResults(): LabResult[] {
    return this.results.filter((r) => r.reviewState === 'CONFIRMED');
  }

  /**
   * Whether any result has been reviewed (confirmed or rejected).
   */
  get hasBeenReviewed(): boolean {
    return this.results.some((r) => r.reviewState !== 'UNREVIEWED');
  }

  /**
   * Whether all results have been reviewed.
   */
  get isFullyReviewed(): boolean {
    return this.results.length > 0 && this.results.every((r) => r.reviewState !== 'UNREVIEWED');
  }
}

export interface LabResultProps {
  id: string;
  labReportId: string;
  index: number;
  name: string;
  value: string;
  unit?: string | null;
  referenceRange?: string | null;
  reviewState: ReviewState;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class LabResult {
  readonly id: string;
  readonly labReportId: string;
  readonly index: number;
  readonly name: string;
  readonly value: string;
  readonly unit: string | null;
  readonly referenceRange: string | null;
  readonly reviewState: ReviewState;
  readonly reviewedBy: string | null;
  readonly reviewedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: LabResultProps) {
    this.id = props.id;
    this.labReportId = props.labReportId;
    this.index = props.index;
    this.name = props.name;
    this.value = props.value;
    this.unit = props.unit ?? null;
    this.referenceRange = props.referenceRange ?? null;
    this.reviewState = props.reviewState;
    this.reviewedBy = props.reviewedBy ?? null;
    this.reviewedAt = props.reviewedAt ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  /**
   * Whether this result is clinical data (confirmed by a clinician).
   */
  get isClinicalData(): boolean {
    return this.reviewState === 'CONFIRMED';
  }

  /**
   * Confirm this result — transitions from UNREVIEWED to CONFIRMED.
   * Returns a new LabResult (immutable).
   */
  confirm(reviewerId: string): LabResult {
    return new LabResult({
      ...this,
      reviewState: 'CONFIRMED',
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    });
  }

  /**
   * Reject this result — transitions from UNREVIEWED to REJECTED.
   * Returns a new LabResult (immutable).
   */
  reject(reviewerId: string): LabResult {
    return new LabResult({
      ...this,
      reviewState: 'REJECTED',
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    });
  }
}
