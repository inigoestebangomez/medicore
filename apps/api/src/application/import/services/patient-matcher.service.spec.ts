// apps/api/src/application/import/services/patient-matcher.service.spec.ts
import { describe, it, expect } from '@jest/globals';
import { PatientMatcherService } from './patient-matcher.service';
import { Patient } from '@/domain/patient/patient.entity';

function makeCandidate(birthDate: Date | null): Patient {
  return new Patient({
    id: 'p1',
    organizationId: 'org-1',
    nhc: '2026-00001',
    firstName: 'Ana',
    lastName: 'Garcia',
    birthDate: birthDate,
    sex: 'FEMALE',
    createdBy: 'u1',
  } as any);
}

const matcher = new PatientMatcherService(null as any);

describe('PatientMatcherService — agesMatch null safety (SDD import-data-quality)', () => {
  it('returns false (does not crash or falsely match) when candidate birthDate is null', () => {
    const candidate = makeCandidate(null);
    expect(matcher.agesMatch(50, candidate, new Date('2026-06-10'))).toBe(false);
  });

  it('returns false for a 0-age row against a null-birthDate candidate (no false match via null→0 coercion)', () => {
    const candidate = makeCandidate(null);
    expect(matcher.agesMatch(0, candidate, new Date('2026-06-10'))).toBe(false);
  });

  it('still matches within tolerance when candidate birthDate is present', () => {
    const candidate = makeCandidate(new Date('1976-01-01'));
    // rowAge 50, candidate age 50 on 2026-06-10 → within ±1
    expect(matcher.agesMatch(50, candidate, new Date('2026-06-10'))).toBe(true);
  });
});

describe('PatientMatcherService — estimated birth dates', () => {
  it('does not award exact-date auto-match points for an estimated birth date', () => {
    const candidate = makeCandidate(new Date('1976-01-01'));
    const result = matcher.score({
      rowIndex: 0, nhc: null, patientName: 'Ana Garcia', birthDate: new Date('1976-01-01'),
      birthDateEstimated: true, birthDateReferenceYear: 2026, age: 50, ageAtImport: 50,
      sex: null, email: null, idDocument: null, idDocType: null, address: null, bloodType: null,
      emergencyContactName: null, emergencyContactPhone: null, emergencyContactRelationship: null, notes: null,
      phone: null, customFields: {}, raw: {}, importedFields: {},
       admissionDate: null, consultationDate: null, diagnosis: null, diagnosisCodes: null, procedure: null,
       chiefComplaint: null, currentIllness: null, physicalExam: null, assessment: null, plan: null,
       followUpDate: null, followUpNotes: null, surgeryDate: null, testType: null, requestDate: null, completionDate: null,
       hospitalStayDays: null, surgeryDurationMinutes: null, consultationType: null, surgeryStatus: null,
       asa: null, anesthesiaType: null, technique: null, findings: null, complications: null, postOpNotes: null, outcome: null,
    }, candidate);

    expect(result.score).toBe(60);
    expect(result.reason).toBe('nombre completo exacto');
  });
});
