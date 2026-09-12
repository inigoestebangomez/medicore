// apps/api/src/domain/clinical-record/lab/lab-report.repository.interface.ts
import type { LabReport, LabResult } from './lab-report.entity';

export interface CreateLabReportInput {
  organizationId: string;
  patientId: string;
  s3Key: string;
  fileName: string;
  ocrPayload?: unknown | null;
  overallReviewState: 'UNREVIEWED' | 'CONFIRMED' | 'REJECTED';
  results: Array<{
    index: number;
    name: string;
    value: string;
    unit?: string | null;
    referenceRange?: string | null;
    reviewState: 'UNREVIEWED' | 'CONFIRMED' | 'REJECTED';
  }>;
  sourceType: string;
  authorId: string;
  recordedAt: Date;
}

export interface UpdateLabResultReviewInput {
  resultId: string;
  reviewState: 'CONFIRMED' | 'REJECTED';
  reviewedBy: string;
  reviewedAt: Date;
}

export interface ILabReportRepository {
  findByPatient(patientId: string, organizationId: string): Promise<LabReport[]>;
  findById(id: string, organizationId: string): Promise<LabReport | null>;
  create(data: CreateLabReportInput): Promise<LabReport>;
  updateResultReview(data: UpdateLabResultReviewInput): Promise<LabResult>;
  updateOverallReviewState(
    reportId: string,
    state: 'UNREVIEWED' | 'CONFIRMED' | 'REJECTED',
  ): Promise<void>;
}
