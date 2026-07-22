// apps/api/src/application/import/services/patient-matcher.service.spec.ts
import { describe, it, expect } from '@jest/globals';
import { PatientMatcherService } from './patient-matcher.service';
import type { CleanedRow } from './data-cleaner.service';
import type { Patient } from '@/domain/patient/patient.entity';

// Minimal factory: build a Patient with only the fields the matcher reads.
// age() derives from birthDate; we pass explicit birthDate so tests are stable.
function makePatient(overrides: Partial<Patient> & { id: string }): Patient {
  const defaults: any = {
    organizationId: 'org-1',
    nhc: '2026-00012',
    firstName: 'Ivan',
    lastName: 'Rumi',
    birthDate: new Date('1975-06-15'),
    sex: 'H',
    phone: null,
    email: null,
    address: null,
    emergencyContact: null,
    idDocument: null,
    idDocType: 'DNI',
    bloodType: 'UNKNOWN',
    notes: null,
    createdBy: 'u-1',
    updatedBy: null,
    allergies: [],
    importedData: null,
    importSource: null,
    importBatchId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
  // Patient constructor is variadic via spread; cast to satisfy TS.
  return new (require('@/domain/patient/patient.entity').Patient as any)({
    ...defaults,
    ...overrides,
  }) as Patient;
}

function makeRow(overrides: Partial<CleanedRow> & { rowIndex: number }): CleanedRow {
  const base: CleanedRow = {
    rowIndex: 0,
    nhc: null,
    patientName: null,
    birthDate: null,
    age: null,
    sex: null,
    admissionDate: null,
    diagnosis: null,
    procedure: null,
    customFields: {},
    raw: {},
  };
  return { ...base, ...overrides };
}

describe('PatientMatcherService', () => {
  describe('BR-IMP-004 scoring thresholds', () => {
    const matcher = new PatientMatcherService({} as any);

    it('NHC exacto → 100 auto', () => {
      const candidate = makePatient({ id: 'p-1', nhc: '13046043' });
      const row = makeRow({ rowIndex: 0, nhc: '13046043', patientName: 'ANA GARCIA' });
      const m = matcher.score(row, candidate);
      expect(m.score).toBe(100);
      expect(m.decision).toBe('auto');
      expect(m.candidateId).toBe('p-1');
      expect(m.reason).toContain('NHC');
    });

    it('NHC with scientific notation normalizes to integer before compare', () => {
      const candidate = makePatient({ id: 'p-2', nhc: '18685362' });
      const row = makeRow({ rowIndex: 0, nhc: '1.8685362E7' });
      const m = matcher.score(row, candidate);
      expect(m.score).toBe(100);
    });

    it('nombre completo + fecha de nacimiento → 90 auto', () => {
      const candidate = makePatient({ id: 'p-3', firstName: 'Ivan', lastName: 'Rumi', birthDate: new Date('1975-06-15') });
      const row = makeRow({ rowIndex: 0, patientName: 'IVÁN RUMÍ', birthDate: new Date('1975-06-15') });
      const m = matcher.score(row, candidate);
      expect(m.score).toBe(90);
      expect(m.decision).toBe('auto');
    });

    it('nombre completo exacto (sin fecha) → 60 confirm', () => {
      const candidate = makePatient({ id: 'p-4', firstName: 'Ana', lastName: 'Garcia' });
      const row = makeRow({ rowIndex: 0, patientName: 'ANA GARCIA' });
      const m = matcher.score(row, candidate);
      expect(m.score).toBe(60);
      expect(m.decision).toBe('confirm');
    });

    it('nombre parcial + edad → 50 confirm (médico decide)', () => {
      // candidate age ~50 (born 1975, ref 2025 → 50). row age 50.
      const candidate = makePatient({ id: 'p-5', firstName: 'Ivan', lastName: 'Rumi', birthDate: new Date('1975-06-15') });
      const row = makeRow({ rowIndex: 0, patientName: 'IVAN', age: 50 });
      const m = matcher.score(row, candidate);
      expect(m.score).toBe(50);
      expect(m.decision).toBe('confirm');
      expect(m.reason).toContain('edad');
    });

    it('nombre parcial (apellidos) → 30 new', () => {
      const candidate = makePatient({ id: 'p-6', firstName: 'Eduardo', lastName: 'Martinez' });
      const row = makeRow({ rowIndex: 0, patientName: 'MARTINEZ LOPEZ' });
      const m = matcher.score(row, candidate);
      expect(m.score).toBe(30);
      expect(m.decision).toBe('new');
      expect(m.candidateId).toBe('p-6');
    });

    it('no signal → 0 new, candidateId null', () => {
      const candidate = makePatient({ id: 'p-7', firstName: 'Pedro', lastName: 'Sanchez' });
      const row = makeRow({ rowIndex: 0, patientName: 'NADIE RELACIONADO' });
      const m = matcher.score(row, candidate);
      expect(m.score).toBe(0);
      expect(m.decision).toBe('new');
      expect(m.candidateId).toBeNull();
    });
  });

  describe('match() orchestration against a mocked repo', () => {
    function buildMatcher(patients: Patient[], byNhc?: Patient | null) {
      const repo: any = {
        findByNhc: async () => byNhc ?? null,
        searchByNameFuzzy: async () => patients,
      };
      return new PatientMatcherService(repo);
    }

    it('auto-matches when a candidate reaches 100 via NHC lookup', async () => {
      const candidate = makePatient({ id: 'auto-1', nhc: '13046043' });
      const matcher = buildMatcher([], candidate);
      const row = makeRow({ rowIndex: 0, nhc: '13046043', patientName: 'ANA' });
      const res = await matcher.match({ organizationId: 'org-1', rows: [row] });
      expect(res.matches[0].score).toBe(100);
      expect(res.matches[0].decision).toBe('auto');
      expect(res.matches[0].candidateId).toBe('auto-1');
    });

    it('picks the highest-scoring candidate', async () => {
      const lowName = makePatient({ id: 'low', firstName: 'Ana', lastName: 'Garcia' });
      const high = makePatient({ id: 'high', firstName: 'Ana', lastName: 'Garcia', birthDate: new Date('1990-01-01') });
      const matcher = buildMatcher([lowName, high]);
      const row = makeRow({ rowIndex: 1, patientName: 'ANA GARCIA', birthDate: new Date('1990-01-01') });
      const res = await matcher.match({ organizationId: 'org-1', rows: [row] });
      expect(res.matches[0].score).toBe(90);
      expect(res.matches[0].candidateId).toBe('high');
    });

    it('returns new (score 0) when no candidates found', async () => {
      const matcher = buildMatcher([]);
      const row = makeRow({ rowIndex: 0, patientName: 'NUEVO PACIENTE' });
      const res = await matcher.match({ organizationId: 'org-1', rows: [row] });
      expect(res.matches[0].score).toBe(0);
      expect(res.matches[0].decision).toBe('new');
      expect(res.matches[0].candidateId).toBeNull();
    });

    it('deduplicates candidates returned by both NHC and name search', async () => {
      const same = makePatient({ id: 'dup', nhc: '13046043', firstName: 'Ana', lastName: 'Garcia' });
      const repo: any = {
        findByNhc: async () => same,
        searchByNameFuzzy: async () => [same],
      };
      const matcher = new PatientMatcherService(repo);
      const row = makeRow({ rowIndex: 0, nhc: '13046043', patientName: 'ANA GARCIA' });
      const res = await matcher.match({ organizationId: 'org-1', rows: [row] });
      expect(res.matches[0].score).toBe(100);
    });
  });
});
