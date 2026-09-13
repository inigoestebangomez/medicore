// apps/api/src/application/clinical-record/clinical-record.integration.spec.ts
// Integration tests for the clinical record use-cases (spec §2–§6).
// Covers: tenant isolation, review gates, template snapshots, catalog validation,
// diagnosis lifecycle, and category read-model aggregation.

import { CreateHistoryEntryUseCase } from './commands/create-history-entry.use-case';
import { CreateCurrentIllnessUseCase } from './commands/create-current-illness.use-case';
import { CreateExamRecordUseCase } from './commands/create-exam-record.use-case';
import { ConfirmLabResultsUseCase } from './commands/confirm-lab-results.use-case';
import { CreateDiagnosisUseCase, InvalidDiagnosisCodeError } from './commands/create-diagnosis.use-case';
import { UpdateDiagnosisStatusUseCase } from './commands/update-diagnosis-status.use-case';
import { GetClinicalRecordUseCase, PatientNotFoundError } from './queries/get-clinical-record.use-case';

import type { IHistoryRepository, CreateHistoryEntryInput } from '@/domain/clinical-record/history/history.repository.interface';
import type { ICurrentIllnessRepository } from '@/domain/clinical-record/current-illness/current-illness.repository.interface';
import type { IPhysicalExamRepository, CreateExamTemplateInput, CreateExamRecordInput } from '@/domain/clinical-record/physical-exam/physical-exam.repository.interface';
import type { ILabReportRepository, CreateLabReportInput } from '@/domain/clinical-record/lab/lab-report.repository.interface';
import type { IDiagnosisRepository } from '@/domain/clinical-record/diagnosis/diagnosis.repository.interface';

import { PatientHistoryEntry } from '@/domain/clinical-record/history/patient-history-entry.entity';
import { CurrentIllnessEntry } from '@/domain/clinical-record/current-illness/current-illness-entry.entity';
import { PhysicalExamTemplate } from '@/domain/clinical-record/physical-exam/physical-exam-template.entity';
import { PhysicalExamRecord } from '@/domain/clinical-record/physical-exam/physical-exam-record.entity';
import { LabReport, LabResult } from '@/domain/clinical-record/lab/lab-report.entity';
import { Diagnosis } from '@/domain/clinical-record/diagnosis/diagnosis.entity';
import { Patient } from '@/domain/patient/patient.entity';

// ─────────────────────────────────────────────
// In-memory fakes (tenant-scoped)
// ─────────────────────────────────────────────

class FakeHistoryRepository implements IHistoryRepository {
  private entries: PatientHistoryEntry[] = [];

  async findByPatient(patientId: string, organizationId: string) {
    return this.entries.filter((e) => e.patientId === patientId && e.organizationId === organizationId);
  }
  async findByPatientAndType(patientId: string, organizationId: string, entryType: any) {
    return this.entries.filter(
      (e) => e.patientId === patientId && e.organizationId === organizationId && e.entryType === entryType,
    );
  }
  async findById(id: string, organizationId: string) {
    return this.entries.find((e) => e.id === id && e.organizationId === organizationId) ?? null;
  }
  async create(data: CreateHistoryEntryInput) {
    const entry = new PatientHistoryEntry({ ...data, id: crypto.randomUUID() });
    this.entries.push(entry);
    return entry;
  }
}

class FakeIllnessRepository implements ICurrentIllnessRepository {
  private entries: CurrentIllnessEntry[] = [];

  async findByPatient(patientId: string, organizationId: string) {
    return this.entries.filter((e) => e.patientId === patientId && e.organizationId === organizationId);
  }
  async findById(id: string, organizationId: string) {
    return this.entries.find((e) => e.id === id && e.organizationId === organizationId) ?? null;
  }
  async create(data: any) {
    const entry = new CurrentIllnessEntry({ ...data, id: crypto.randomUUID() });
    this.entries.push(entry);
    return entry;
  }
}

class FakeExamRepository implements IPhysicalExamRepository {
  private templates: PhysicalExamTemplate[] = [];
  private records: PhysicalExamRecord[] = [];

  async findTemplateById(id: string, organizationId: string) {
    return this.templates.find((t) => t.id === id && t.organizationId === organizationId) ?? null;
  }
  async findLatestTemplate(organizationId: string, specialty: string) {
    const matches = this.templates.filter((t) => t.organizationId === organizationId && t.specialty === specialty);
    return matches.sort((a, b) => b.version - a.version)[0] ?? null;
  }
  async createTemplate(data: CreateExamTemplateInput) {
    const t = new PhysicalExamTemplate({ ...data, id: crypto.randomUUID() });
    this.templates.push(t);
    return t;
  }
  async findRecordsByPatient(patientId: string, organizationId: string) {
    return this.records.filter((r) => r.patientId === patientId && r.organizationId === organizationId);
  }
  async findRecordById(id: string, organizationId: string) {
    return this.records.find((r) => r.id === id && r.organizationId === organizationId) ?? null;
  }
  async createRecord(data: CreateExamRecordInput) {
    const r = new PhysicalExamRecord({ ...data, id: crypto.randomUUID() });
    this.records.push(r);
    return r;
  }
}

class FakeLabRepository implements ILabReportRepository {
  private reports: LabReport[] = [];

  async findByPatient(patientId: string, organizationId: string) {
    return this.reports.filter((r) => r.patientId === patientId && r.organizationId === organizationId);
  }
  async findById(id: string, organizationId: string) {
    return this.reports.find((r) => r.id === id && r.organizationId === organizationId) ?? null;
  }
  async create(data: CreateLabReportInput) {
    const results = data.results.map(
      (r) =>
        new LabResult({
          id: crypto.randomUUID(),
          labReportId: '', // will be set below
          index: r.index,
          name: r.name,
          value: r.value,
          unit: r.unit ?? null,
          referenceRange: r.referenceRange ?? null,
          reviewState: r.reviewState,
        }),
    );
    const report = new LabReport({
      id: crypto.randomUUID(),
      organizationId: data.organizationId,
      patientId: data.patientId,
      s3Key: data.s3Key,
      fileName: data.fileName,
      ocrPayload: data.ocrPayload ?? null,
      overallReviewState: data.overallReviewState,
      sourceType: data.sourceType,
      authorId: data.authorId,
      recordedAt: data.recordedAt,
      results,
    });
    // Fix labReportId references
    for (const r of results) {
      (r as any).labReportId = report.id;
    }
    this.reports.push(report);
    return report;
  }
  async updateResultReview(data: any) {
    for (const report of this.reports) {
      const idx = report.results.findIndex((r) => r.id === data.resultId);
      if (idx >= 0) {
        const old = report.results[idx];
        const updated = new LabResult({
          ...old,
          reviewState: data.reviewState,
          reviewedBy: data.reviewedBy,
          reviewedAt: data.reviewedAt,
        });
        report.results[idx] = updated;
        return updated;
      }
    }
    throw new Error('Result not found');
  }
  async updateOverallReviewState(reportId: string, state: any) {
    const report = this.reports.find((r) => r.id === reportId);
    if (report) {
      (report as any).overallReviewState = state;
    }
  }
}

class FakeDiagnosisRepository implements IDiagnosisRepository {
  private diagnoses: Diagnosis[] = [];

  async findByPatient(patientId: string, organizationId: string) {
    return this.diagnoses.filter((d) => d.patientId === patientId && d.organizationId === organizationId);
  }
  async findActiveByPatient(patientId: string, organizationId: string) {
    return this.diagnoses.filter(
      (d) => d.patientId === patientId && d.organizationId === organizationId && d.status === 'ACTIVE',
    );
  }
  async findById(id: string, organizationId: string) {
    return this.diagnoses.find((d) => d.id === id && d.organizationId === organizationId) ?? null;
  }
  async create(data: any) {
    const d = new Diagnosis({ ...data, id: crypto.randomUUID() });
    this.diagnoses.push(d);
    return d;
  }
  async updateStatus(id: string, organizationId: string, status: any, extra: any) {
    const idx = this.diagnoses.findIndex((d) => d.id === id && d.organizationId === organizationId);
    if (idx < 0) throw new Error('Diagnosis not found');
    const old = this.diagnoses[idx];
    const updated = new Diagnosis({ ...old, status, ...extra });
    this.diagnoses[idx] = updated;
    return updated;
  }
}

class FakePatientRepository {
  private patients: Patient[] = [];

  addPatient(id: string, organizationId: string) {
    const p = new Patient({
      id,
      organizationId,
      nhc: '2024-001',
      firstName: 'Test',
      lastName: 'Patient',
      birthDate: new Date('1990-01-01'),
      sex: 'MALE',
      createdBy: 'user-1',
    });
    this.patients.push(p);
    return p;
  }

  async findById(id: string, organizationId: string) {
    return this.patients.find((p) => p.id === id && p.organizationId === organizationId) ?? null;
  }
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('Clinical Record Integration', () => {
  const ORG_A = 'org-a';
  const ORG_B = 'org-b';
  const PATIENT_A = 'patient-a';
  const AUTHOR = 'user-1';

  let historyRepo: FakeHistoryRepository;
  let illnessRepo: FakeIllnessRepository;
  let examRepo: FakeExamRepository;
  let labRepo: FakeLabRepository;
  let diagnosisRepo: FakeDiagnosisRepository;
  let patientRepo: FakePatientRepository;

  beforeEach(() => {
    historyRepo = new FakeHistoryRepository();
    illnessRepo = new FakeIllnessRepository();
    examRepo = new FakeExamRepository();
    labRepo = new FakeLabRepository();
    diagnosisRepo = new FakeDiagnosisRepository();
    patientRepo = new FakePatientRepository();
    patientRepo.addPatient(PATIENT_A, ORG_A);
  });

  describe('History (spec §2)', () => {
    it('creates a history entry with provenance', async () => {
      const uc = new CreateHistoryEntryUseCase(historyRepo);
      const entry = await uc.execute({
        organizationId: ORG_A,
        patientId: PATIENT_A,
        entryType: 'ALLERGY',
        key: 'Penicilina',
        value: 'Anafilaxis',
        sourceType: 'manual',
        authorId: AUTHOR,
      });

      expect(entry.entryType).toBe('ALLERGY');
      expect(entry.key).toBe('Penicilina');
      expect(entry.reviewState).toBe('UNREVIEWED');
      expect(entry.authorId).toBe(AUTHOR);
    });

    it('tenant isolation: org B cannot see org A entries', async () => {
      const uc = new CreateHistoryEntryUseCase(historyRepo);
      await uc.execute({
        organizationId: ORG_A,
        patientId: PATIENT_A,
        entryType: 'FAMILY',
        key: 'Madre',
        value: 'Diabetes tipo 2',
        sourceType: 'manual',
        authorId: AUTHOR,
      });

      const orgBResults = await historyRepo.findByPatient(PATIENT_A, ORG_B);
      expect(orgBResults).toHaveLength(0);
    });
  });

  describe('Current Illness (spec §3)', () => {
    it('creates a partial illness entry (missing temporal fields remain null)', async () => {
      const uc = new CreateCurrentIllnessUseCase(illnessRepo);
      const entry = await uc.execute({
        organizationId: ORG_A,
        patientId: PATIENT_A,
        symptoms: 'Cefalea frontal',
        sourceType: 'manual',
        authorId: AUTHOR,
      });

      expect(entry.symptoms).toBe('Cefalea frontal');
      expect(entry.durationValue).toBeNull();
      expect(entry.durationUnit).toBeNull();
      expect(entry.onset).toBeNull();
      expect(entry.hasTemporalData).toBe(false);
    });
  });

  describe('Physical Exam template versioning (spec §4)', () => {
    it('pins template version + schema snapshot at record creation', async () => {
      // Create template v1
      const template = await examRepo.createTemplate({
        organizationId: ORG_A,
        specialty: 'ORL',
        version: 1,
        fields: [
          { key: 'otoscopy', label: 'Otoscopia', type: 'TEXT', required: true },
        ],
        publishedAt: new Date(),
      });

      // Create record with v1
      const uc = new CreateExamRecordUseCase(examRepo);
      const record = await uc.execute({
        organizationId: ORG_A,
        patientId: PATIENT_A,
        templateId: template.id,
        values: { otoscopy: 'Normal' },
        sourceType: 'manual',
        authorId: AUTHOR,
      });

      expect(record.templateVersion).toBe(1);
      expect(record.templateSchemaSnapshot).toHaveLength(1);
      expect(record.templateSchemaSnapshot[0].key).toBe('otoscopy');
    });

    it('historical records remain interpretable after template changes', async () => {
      // Create template v1
      const v1 = await examRepo.createTemplate({
        organizationId: ORG_A,
        specialty: 'Cardiología',
        version: 1,
        fields: [{ key: 'hr', label: 'Heart Rate', type: 'NUMBER', required: true }],
        publishedAt: new Date(),
      });

      // Create record with v1
      const uc = new CreateExamRecordUseCase(examRepo);
      const record = await uc.execute({
        organizationId: ORG_A,
        patientId: PATIENT_A,
        templateId: v1.id,
        values: { hr: 72 },
        sourceType: 'manual',
        authorId: AUTHOR,
      });

      // Create template v2 with different fields
      await examRepo.createTemplate({
        organizationId: ORG_A,
        specialty: 'Cardiología',
        version: 2,
        fields: [
          { key: 'hr', label: 'Heart Rate', type: 'NUMBER', required: true },
          { key: 'bp', label: 'Blood Pressure', type: 'TEXT', required: false },
        ],
        publishedAt: new Date(),
      });

      // The old record still uses v1 snapshot — getValue works with pinned schema
      expect(record.getValue('hr')).toBe(72);
      expect(record.getSnapshotField('hr')?.label).toBe('Heart Rate');
      // v2 field is NOT in the old record's snapshot
      expect(record.getSnapshotField('bp')).toBeUndefined();
    });

    it('rejects record creation when required fields are missing', async () => {
      const template = await examRepo.createTemplate({
        organizationId: ORG_A,
        specialty: 'ORL',
        version: 1,
        fields: [{ key: 'otoscopy', label: 'Otoscopia', type: 'TEXT', required: true }],
        publishedAt: new Date(),
      });

      const uc = new CreateExamRecordUseCase(examRepo);
      await expect(
        uc.execute({
          organizationId: ORG_A,
          patientId: PATIENT_A,
          templateId: template.id,
          values: {}, // missing required 'otoscopy'
          sourceType: 'manual',
          authorId: AUTHOR,
        }),
      ).rejects.toThrow("Required field 'otoscopy' is missing");
    });
  });

  describe('OCR review gate (spec §5)', () => {
    it('only CONFIRMED results become clinical data', async () => {
      const report = await labRepo.create({
        organizationId: ORG_A,
        patientId: PATIENT_A,
        s3Key: 'org-a/patients/patient-a/labs/report-1/hemograma.pdf',
        fileName: 'hemograma.pdf',
        overallReviewState: 'UNREVIEWED',
        results: [
          { index: 0, name: 'Hemoglobin', value: '14.2', unit: 'g/dL', reviewState: 'UNREVIEWED' },
          { index: 1, name: 'Leukocytes', value: '7500', unit: '/µL', reviewState: 'UNREVIEWED' },
        ],
        sourceType: 'ocr',
        authorId: AUTHOR,
        recordedAt: new Date(),
      });

      expect(report.confirmedResults).toHaveLength(0);

      const uc = new ConfirmLabResultsUseCase(labRepo);
      const confirmed = await uc.execute({
        organizationId: ORG_A,
        reportId: report.id,
        results: [{ index: 0, reviewState: 'CONFIRMED' }],
        reviewerId: AUTHOR,
      });

      expect(confirmed).not.toBeNull();
      const confirmedResult = confirmed!.results.find((r) => r.index === 0);
      expect(confirmedResult?.reviewState).toBe('CONFIRMED');
      expect(confirmedResult?.isClinicalData).toBe(true);
    });

    it('preserves OCR provenance after confirmation', async () => {
      const report = await labRepo.create({
        organizationId: ORG_A,
        patientId: PATIENT_A,
        s3Key: 'org-a/patients/patient-a/labs/report-2/biochem.pdf',
        fileName: 'biochem.pdf',
        ocrPayload: { engine: 'tesseract', confidence: 0.92 },
        overallReviewState: 'UNREVIEWED',
        results: [
          { index: 0, name: 'Glucose', value: '95', unit: 'mg/dL', reviewState: 'UNREVIEWED' },
        ],
        sourceType: 'ocr',
        authorId: AUTHOR,
        recordedAt: new Date(),
      });

      expect(report.ocrPayload).toEqual({ engine: 'tesseract', confidence: 0.92 });
      expect(report.sourceType).toBe('ocr');

      const uc = new ConfirmLabResultsUseCase(labRepo);
      await uc.execute({
        organizationId: ORG_A,
        reportId: report.id,
        results: [{ index: 0, reviewState: 'CONFIRMED' }],
        reviewerId: 'reviewer-1',
      });

      const refreshed = await labRepo.findById(report.id, ORG_A);
      expect(refreshed?.ocrPayload).toEqual({ engine: 'tesseract', confidence: 0.92 });
      expect(refreshed?.sourceType).toBe('ocr');
    });
  });

  describe('Diagnosis catalog validation (spec §6)', () => {
    it('rejects unknown diagnosis codes', async () => {
      const uc = new CreateDiagnosisUseCase(diagnosisRepo);
      await expect(
        uc.execute({
          organizationId: ORG_A,
          patientId: PATIENT_A,
          system: 'CIE-10-ES',
          code: 'INVALID.CODE',
          catalogVersion: '2024',
          sourceType: 'manual',
          authorId: AUTHOR,
        }),
      ).rejects.toThrow(InvalidDiagnosisCodeError);
    });

    it('accepts valid CIE-10-ES codes', async () => {
      const uc = new CreateDiagnosisUseCase(diagnosisRepo);
      const diagnosis = await uc.execute({
        organizationId: ORG_A,
        patientId: PATIENT_A,
        system: 'CIE-10-ES',
        code: 'J32.0', // Chronic maxillary sinusitis — from the catalog
        catalogVersion: '2024',
        sourceType: 'manual',
        authorId: AUTHOR,
      });

      expect(diagnosis.status).toBe('ACTIVE');
      expect(diagnosis.code).toBe('J32.0');
      expect(diagnosis.isActive).toBe(true);
    });

    it('discarded diagnoses excluded from active stats but retained for audit', async () => {
      const uc = new CreateDiagnosisUseCase(diagnosisRepo);
      const diagnosis = await uc.execute({
        organizationId: ORG_A,
        patientId: PATIENT_A,
        system: 'CIE-10-ES',
        code: 'J32.0',
        catalogVersion: '2024',
        sourceType: 'manual',
        authorId: AUTHOR,
      });

      const statusUc = new UpdateDiagnosisStatusUseCase(diagnosisRepo);
      const discarded = await statusUc.execute({
        organizationId: ORG_A,
        diagnosisId: diagnosis.id,
        status: 'DISCARDED',
        reviewerId: 'reviewer-1',
      });

      expect(discarded.status).toBe('DISCARDED');
      expect(discarded.isActive).toBe(false);
      expect(discarded.discardedBy).toBe('reviewer-1');

      // Still findable for audit
      const all = await diagnosisRepo.findByPatient(PATIENT_A, ORG_A);
      expect(all).toHaveLength(1);

      // But not in active list
      const active = await diagnosisRepo.findActiveByPatient(PATIENT_A, ORG_A);
      expect(active).toHaveLength(0);
    });
  });

  describe('Category read-model query', () => {
    it('aggregates history entries for the history category', async () => {
      const historyUc = new CreateHistoryEntryUseCase(historyRepo);
      await historyUc.execute({
        organizationId: ORG_A,
        patientId: PATIENT_A,
        entryType: 'ALLERGY',
        key: 'Penicilina',
        value: 'Anafilaxis',
        sourceType: 'manual',
        authorId: AUTHOR,
      });
      await historyUc.execute({
        organizationId: ORG_A,
        patientId: PATIENT_A,
        entryType: 'ECOG',
        key: 'ECOG',
        value: '1',
        sourceType: 'manual',
        authorId: AUTHOR,
      });

      const queryUc = new GetClinicalRecordUseCase(
        patientRepo as any,
        historyRepo,
        illnessRepo,
        examRepo,
        labRepo,
        diagnosisRepo,
      );

      const result = await queryUc.execute({
        organizationId: ORG_A,
        patientId: PATIENT_A,
        category: 'history',
      });

      expect(result.category).toBe('history');
      expect(result.totalCount).toBe(2);
      expect(result.data).toHaveLength(2);
    });

    it('throws PatientNotFoundError for unknown patient (tenant isolation)', async () => {
      const queryUc = new GetClinicalRecordUseCase(
        patientRepo as any,
        historyRepo,
        illnessRepo,
        examRepo,
        labRepo,
        diagnosisRepo,
      );

      await expect(
        queryUc.execute({
          organizationId: ORG_B, // wrong org
          patientId: PATIENT_A,
          category: 'history',
        }),
      ).rejects.toThrow(PatientNotFoundError);
    });
  });
});
