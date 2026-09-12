import { describe, it, expect } from 'vitest';
import {
  ClinicalRecordCategorySchema,
  ReviewStateSchema,
  ProvenanceSchema,
  AgeReferenceDateSchema,
  HistoryEntryTypeSchema,
  CreateHistoryEntrySchema,
  DurationUnitSchema,
  CreateCurrentIllnessSchema,
  ExamTemplateFieldSchema,
  CustomFindingSchema,
  CreatePhysicalExamRecordSchema,
  CreateLabReportSchema,
  LabResultItemSchema,
  ConfirmLabResultsSchema,
  DiagnosisCodeSystemSchema,
  DiagnosisStatusSchema,
  CreateDiagnosisSchema,
  UpdateDiagnosisStatusSchema,
  DicomMetadataSchema,
  ClinicalRecordResponseSchema,
} from './clinical-record.schema';

describe('clinical-record.schema', () => {
  // ─── ClinicalRecordCategory ───────────────────

  describe('ClinicalRecordCategorySchema', () => {
    it('should accept all seven categories', () => {
      const categories = [
        'patient-data', 'history', 'current-illness', 'physical-exam',
        'complementary-tests', 'diagnosis', 'treatment',
      ] as const;
      for (const cat of categories) {
        expect(ClinicalRecordCategorySchema.parse(cat)).toBe(cat);
      }
    });

    it('should reject invalid category', () => {
      expect(() => ClinicalRecordCategorySchema.parse('invalid')).toThrow();
    });
  });

  // ─── ReviewState ──────────────────────────────

  describe('ReviewStateSchema', () => {
    it('should accept UNREVIEWED, CONFIRMED, REJECTED', () => {
      for (const state of ['UNREVIEWED', 'CONFIRMED', 'REJECTED'] as const) {
        expect(ReviewStateSchema.parse(state)).toBe(state);
      }
    });

    it('should reject invalid state', () => {
      expect(() => ReviewStateSchema.parse('PENDING')).toThrow();
    });
  });

  // ─── Provenance ───────────────────────────────

  describe('ProvenanceSchema', () => {
    const validProvenance = {
      sourceType: 'manual',
      authorId: '550e8400-e29b-41d4-a716-446655440000',
      recordedAt: '2026-09-12T10:00:00.000Z',
    };

    it('should accept valid provenance with default reviewState', () => {
      const result = ProvenanceSchema.parse(validProvenance);
      expect(result.reviewState).toBe('UNREVIEWED');
      expect(result.sourceType).toBe('manual');
    });

    it('should accept provenance with explicit reviewState', () => {
      const result = ProvenanceSchema.parse({ ...validProvenance, reviewState: 'CONFIRMED' });
      expect(result.reviewState).toBe('CONFIRMED');
    });

    it('should accept provenance with sourceId', () => {
      const result = ProvenanceSchema.parse({
        ...validProvenance,
        sourceType: 'dual-write',
        sourceId: '550e8400-e29b-41d4-a716-446655440001',
      });
      expect(result.sourceId).toBe('550e8400-e29b-41d4-a716-446655440001');
    });

    it('should reject missing sourceType', () => {
      const { sourceType, ...rest } = validProvenance;
      expect(() => ProvenanceSchema.parse(rest)).toThrow();
    });

    it('should reject missing authorId', () => {
      const { authorId, ...rest } = validProvenance;
      expect(() => ProvenanceSchema.parse(rest)).toThrow();
    });
  });

  // ─── AgeReferenceDate ─────────────────────────

  describe('AgeReferenceDateSchema', () => {
    it('should accept valid full date', () => {
      const result = AgeReferenceDateSchema.parse({ day: 15, month: 6, year: 2026 });
      expect(result).toEqual({ day: 15, month: 6, year: 2026 });
    });

    it('should reject day out of range', () => {
      expect(() => AgeReferenceDateSchema.parse({ day: 0, month: 6, year: 2026 })).toThrow();
      expect(() => AgeReferenceDateSchema.parse({ day: 32, month: 6, year: 2026 })).toThrow();
    });

    it('should reject month out of range', () => {
      expect(() => AgeReferenceDateSchema.parse({ day: 15, month: 0, year: 2026 })).toThrow();
      expect(() => AgeReferenceDateSchema.parse({ day: 15, month: 13, year: 2026 })).toThrow();
    });

    it('should reject year out of range', () => {
      expect(() => AgeReferenceDateSchema.parse({ day: 15, month: 6, year: 1800 })).toThrow();
      expect(() => AgeReferenceDateSchema.parse({ day: 15, month: 6, year: 2200 })).toThrow();
    });
  });

  // ─── History ──────────────────────────────────

  describe('CreateHistoryEntrySchema', () => {
    const validEntry = {
      entryType: 'ALLERGY' as const,
      key: 'Penicilina',
      value: 'Anaphylaxis reaction in childhood',
      provenance: {
        sourceType: 'manual',
        authorId: '550e8400-e29b-41d4-a716-446655440000',
        recordedAt: '2026-09-12T10:00:00.000Z',
      },
    };

    it('should accept valid history entry', () => {
      const result = CreateHistoryEntrySchema.parse(validEntry);
      expect(result.entryType).toBe('ALLERGY');
      expect(result.provenance.reviewState).toBe('UNREVIEWED');
    });

    it('should accept all history entry types', () => {
      const types = ['PERSONAL', 'ALLERGY', 'SURGICAL', 'TOXIC_HABIT', 'PROFESSION', 'FAMILY', 'ECOG'] as const;
      for (const entryType of types) {
        const result = CreateHistoryEntrySchema.parse({ ...validEntry, entryType });
        expect(result.entryType).toBe(entryType);
      }
    });

    it('should reject empty key', () => {
      expect(() => CreateHistoryEntrySchema.parse({ ...validEntry, key: '' })).toThrow();
    });

    it('should reject value exceeding max length', () => {
      expect(() => CreateHistoryEntrySchema.parse({ ...validEntry, value: 'x'.repeat(5001) })).toThrow();
    });
  });

  // ─── Current Illness ─────────────────────────

  describe('CreateCurrentIllnessSchema', () => {
    const validIllness = {
      symptoms: 'Nasal congestion and facial pain',
      provenance: {
        sourceType: 'manual',
        authorId: '550e8400-e29b-41d4-a716-446655440000',
        recordedAt: '2026-09-12T10:00:00.000Z',
      },
    };

    it('should accept minimal illness (only symptoms + provenance)', () => {
      const result = CreateCurrentIllnessSchema.parse(validIllness);
      expect(result.symptoms).toBe('Nasal congestion and facial pain');
      expect(result.durationValue).toBeUndefined();
      expect(result.durationUnit).toBeUndefined();
      expect(result.onset).toBeUndefined();
    });

    it('should accept full illness with temporal data', () => {
      const result = CreateCurrentIllnessSchema.parse({
        ...validIllness,
        durationValue: 5,
        durationUnit: 'DAYS',
        onset: '2026-09-07T08:00:00.000Z',
        evolution: 'Worsening after 3 days',
        narrative: 'Patient reports progressive symptoms',
        consultationId: '550e8400-e29b-41d4-a716-446655440001',
      });
      expect(result.durationValue).toBe(5);
      expect(result.durationUnit).toBe('DAYS');
    });

    it('should accept all duration units', () => {
      for (const unit of ['HOURS', 'DAYS', 'WEEKS', 'MONTHS', 'YEARS'] as const) {
        const result = CreateCurrentIllnessSchema.parse({ ...validIllness, durationUnit: unit });
        expect(result.durationUnit).toBe(unit);
      }
    });

    it('should reject empty symptoms', () => {
      expect(() => CreateCurrentIllnessSchema.parse({ ...validIllness, symptoms: '' })).toThrow();
    });
  });

  // ─── Physical Exam ───────────────────────────

  describe('CreatePhysicalExamRecordSchema', () => {
    const validExam = {
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      templateId: '550e8400-e29b-41d4-a716-446655440001',
      templateVersion: 1,
      values: { 'nasal_obstruction': 'moderate', 'polyps': false },
      provenance: {
        sourceType: 'manual',
        authorId: '550e8400-e29b-41d4-a716-446655440002',
        recordedAt: '2026-09-12T10:00:00.000Z',
      },
    };

    it('should accept valid exam record', () => {
      const result = CreatePhysicalExamRecordSchema.parse(validExam);
      expect(result.templateVersion).toBe(1);
      expect(result.values).toEqual({ 'nasal_obstruction': 'moderate', 'polyps': false });
    });

    it('should accept custom findings', () => {
      const result = CreatePhysicalExamRecordSchema.parse({
        ...validExam,
        customFindings: [{ label: 'Deviation note', value: 'Left septal deviation' }],
      });
      expect(result.customFindings).toHaveLength(1);
    });

    it('should reject templateVersion < 1', () => {
      expect(() => CreatePhysicalExamRecordSchema.parse({ ...validExam, templateVersion: 0 })).toThrow();
    });
  });

  // ─── Lab Reports ─────────────────────────────

  describe('CreateLabReportSchema', () => {
    it('should accept valid lab report', () => {
      const result = CreateLabReportSchema.parse({
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        s3Key: 'org-1/patients/p1/labs/report-001.pdf',
        fileName: 'bloodwork-2026.pdf',
        provenance: {
          sourceType: 'ocr',
          authorId: '550e8400-e29b-41d4-a716-446655440002',
          recordedAt: '2026-09-12T10:00:00.000Z',
        },
      });
      expect(result.s3Key).toContain('labs/');
    });

    it('should reject empty s3Key', () => {
      expect(() => CreateLabReportSchema.parse({
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        s3Key: '',
        fileName: 'test.pdf',
        provenance: {
          sourceType: 'ocr',
          authorId: '550e8400-e29b-41d4-a716-446655440002',
          recordedAt: '2026-09-12T10:00:00.000Z',
        },
      })).toThrow();
    });
  });

  describe('LabResultItemSchema', () => {
    it('should default reviewState to UNREVIEWED', () => {
      const result = LabResultItemSchema.parse({ name: 'Hemoglobin', value: '14.2' });
      expect(result.reviewState).toBe('UNREVIEWED');
    });

    it('should accept CONFIRMED state', () => {
      const result = LabResultItemSchema.parse({
        name: 'Hemoglobin', value: '14.2', unit: 'g/dL', reviewState: 'CONFIRMED',
      });
      expect(result.reviewState).toBe('CONFIRMED');
    });
  });

  describe('ConfirmLabResultsSchema', () => {
    it('should accept valid confirmation', () => {
      const result = ConfirmLabResultsSchema.parse({
        reportId: '550e8400-e29b-41d4-a716-446655440000',
        results: [
          { index: 0, reviewState: 'CONFIRMED' },
          { index: 1, reviewState: 'REJECTED' },
        ],
        reviewerId: '550e8400-e29b-41d4-a716-446655440002',
      });
      expect(result.results).toHaveLength(2);
    });

    it('should reject invalid reviewState in results', () => {
      expect(() => ConfirmLabResultsSchema.parse({
        reportId: '550e8400-e29b-41d4-a716-446655440000',
        results: [{ index: 0, reviewState: 'UNREVIEWED' }],
        reviewerId: '550e8400-e29b-41d4-a716-446655440002',
      })).toThrow();
    });
  });

  // ─── Diagnosis ───────────────────────────────

  describe('CreateDiagnosisSchema', () => {
    const validDiagnosis = {
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      system: 'CIE-10-ES' as const,
      code: 'J32.0',
      description: 'Chronic maxillary sinusitis',
      catalogVersion: '2024',
      provenance: {
        sourceType: 'manual',
        authorId: '550e8400-e29b-41d4-a716-446655440002',
        recordedAt: '2026-09-12T10:00:00.000Z',
      },
    };

    it('should accept valid diagnosis with default ACTIVE status', () => {
      const result = CreateDiagnosisSchema.parse(validDiagnosis);
      expect(result.status).toBe('ACTIVE');
      expect(result.system).toBe('CIE-10-ES');
    });

    it('should accept SNOMED system', () => {
      const result = CreateDiagnosisSchema.parse({ ...validDiagnosis, system: 'SNOMED' });
      expect(result.system).toBe('SNOMED');
    });

    it('should accept clinical variables', () => {
      const result = CreateDiagnosisSchema.parse({
        ...validDiagnosis,
        variables: { severity: 'moderate', side: 'left' },
      });
      expect(result.variables).toEqual({ severity: 'moderate', side: 'left' });
    });

    it('should reject empty code', () => {
      expect(() => CreateDiagnosisSchema.parse({ ...validDiagnosis, code: '' })).toThrow();
    });

    it('should reject invalid code system', () => {
      expect(() => CreateDiagnosisSchema.parse({ ...validDiagnosis, system: 'ICD10' })).toThrow();
    });
  });

  describe('UpdateDiagnosisStatusSchema', () => {
    it('should accept RESOLVED', () => {
      const result = UpdateDiagnosisStatusSchema.parse({
        status: 'RESOLVED',
        reviewerId: '550e8400-e29b-41d4-a716-446655440002',
      });
      expect(result.status).toBe('RESOLVED');
    });

    it('should accept DISCARDED', () => {
      const result = UpdateDiagnosisStatusSchema.parse({
        status: 'DISCARDED',
        reviewerId: '550e8400-e29b-41d4-a716-446655440002',
      });
      expect(result.status).toBe('DISCARDED');
    });

    it('should reject ACTIVE (cannot transition back to active)', () => {
      expect(() => UpdateDiagnosisStatusSchema.parse({
        status: 'ACTIVE',
        reviewerId: '550e8400-e29b-41d4-a716-446655440002',
      })).toThrow();
    });
  });

  // ─── DICOM Metadata ──────────────────────────

  describe('DicomMetadataSchema', () => {
    it('should accept valid DICOM metadata with default R2 backend', () => {
      const result = DicomMetadataSchema.parse({
        studyInstanceUid: '1.2.840.113619.2.1.1.3.2086252777',
        storageKey: 'org-1/patients/p1/dicom/study-001',
      });
      expect(result.storageBackend).toBe('R2');
    });

    it('should accept full DICOM metadata', () => {
      const result = DicomMetadataSchema.parse({
        studyInstanceUid: '1.2.840.113619.2.1.1.3.2086252777',
        seriesInstanceUid: '1.2.840.113619.2.1.1.3.2086252777.1',
        sopInstanceUid: '1.2.840.113619.2.1.1.3.2086252777.1.1',
        modality: 'CT',
        storageKey: 'org-1/patients/p1/dicom/study-001',
      });
      expect(result.modality).toBe('CT');
    });

    it('should reject empty studyInstanceUid', () => {
      expect(() => DicomMetadataSchema.parse({
        studyInstanceUid: '',
        storageKey: 'key',
      })).toThrow();
    });
  });

  // ─── ClinicalRecordResponse ──────────────────

  describe('ClinicalRecordResponseSchema', () => {
    it('should accept valid response', () => {
      const result = ClinicalRecordResponseSchema.parse({
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        category: 'history',
        data: [{ id: '1', key: 'allergy', value: 'penicillin' }],
        totalCount: 1,
      });
      expect(result.category).toBe('history');
      expect(result.totalCount).toBe(1);
    });

    it('should accept empty data array', () => {
      const result = ClinicalRecordResponseSchema.parse({
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        category: 'diagnosis',
        data: [],
        totalCount: 0,
      });
      expect(result.data).toEqual([]);
    });
  });
});
