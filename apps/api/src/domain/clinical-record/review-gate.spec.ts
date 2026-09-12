// apps/api/src/domain/clinical-record/review-gate.spec.ts
// Tests for OCR review gate (spec §5) — values start UNREVIEWED;
// only CONFIRMED become clinical data; provenance retained.
import { describe, it, expect } from '@jest/globals';
import { LabReport, LabResult } from './lab/lab-report.entity';

function makeLabResult(overrides: Partial<{
  reviewState: 'UNREVIEWED' | 'CONFIRMED' | 'REJECTED';
}> = {}): LabResult {
  return new LabResult({
    id: 'result-1',
    labReportId: 'report-1',
    index: 0,
    name: 'Hemoglobin',
    value: '14.2',
    unit: 'g/dL',
    reviewState: overrides.reviewState ?? 'UNREVIEWED',
  });
}

function makeLabReport(results: LabResult[]): LabReport {
  return new LabReport({
    id: 'report-1',
    organizationId: 'org-1',
    patientId: 'patient-1',
    s3Key: 'org-1/patients/p1/labs/report.pdf',
    fileName: 'report.pdf',
    ocrPayload: { raw: 'extracted text' },
    overallReviewState: 'UNREVIEWED',
    results,
    sourceType: 'ocr',
    authorId: 'user-1',
    recordedAt: new Date('2026-09-12'),
  });
}

describe('Lab review gate (spec §5)', () => {
  describe('LabResult', () => {
    it('should start as UNREVIEWED', () => {
      const result = makeLabResult();
      expect(result.reviewState).toBe('UNREVIEWED');
      expect(result.isClinicalData).toBe(false);
    });

    it('should become CONFIRMED via confirm()', () => {
      const result = makeLabResult();
      const confirmed = result.confirm('reviewer-1');
      expect(confirmed.reviewState).toBe('CONFIRMED');
      expect(confirmed.isClinicalData).toBe(true);
      expect(confirmed.reviewedBy).toBe('reviewer-1');
      expect(confirmed.reviewedAt).not.toBeNull();
    });

    it('should become REJECTED via reject()', () => {
      const result = makeLabResult();
      const rejected = result.reject('reviewer-1');
      expect(rejected.reviewState).toBe('REJECTED');
      expect(rejected.isClinicalData).toBe(false);
    });

    it('should be immutable — confirm returns new instance', () => {
      const original = makeLabResult();
      const confirmed = original.confirm('reviewer-1');
      expect(original.reviewState).toBe('UNREVIEWED');
      expect(confirmed.reviewState).toBe('CONFIRMED');
    });
  });

  describe('LabReport', () => {
    it('should have no confirmed results when all UNREVIEWED', () => {
      const report = makeLabReport([
        makeLabResult({ reviewState: 'UNREVIEWED' }),
        makeLabResult({ reviewState: 'UNREVIEWED' }),
      ]);
      expect(report.confirmedResults).toHaveLength(0);
      expect(report.hasBeenReviewed).toBe(false);
    });

    it('should return only CONFIRMED results as clinical data', () => {
      const report = makeLabReport([
        makeLabResult({ reviewState: 'CONFIRMED' }),
        makeLabResult({ reviewState: 'UNREVIEWED' }),
        makeLabResult({ reviewState: 'REJECTED' }),
      ]);
      expect(report.confirmedResults).toHaveLength(1);
      expect(report.hasBeenReviewed).toBe(true);
      expect(report.isFullyReviewed).toBe(false);
    });

    it('should be fully reviewed when all results are reviewed', () => {
      const report = makeLabReport([
        makeLabResult({ reviewState: 'CONFIRMED' }),
        makeLabResult({ reviewState: 'REJECTED' }),
      ]);
      expect(report.isFullyReviewed).toBe(true);
    });

    it('should retain OCR provenance', () => {
      const report = makeLabReport([]);
      expect(report.sourceType).toBe('ocr');
      expect(report.ocrPayload).toEqual({ raw: 'extracted text' });
    });
  });
});
