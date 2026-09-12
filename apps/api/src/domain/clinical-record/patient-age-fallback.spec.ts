// apps/api/src/domain/clinical-record/patient-age-fallback.spec.ts
// Tests for age() fallback logic (spec §1) — never fabricates a birth date.
import { describe, it, expect } from '@jest/globals';
import { Patient } from '../patient/patient.entity';

function makePatient(overrides: Partial<{
  birthDate: Date | null;
  ageReferenceDate: { day: number; month: number; year: number } | null;
  ageAtReferenceDate: number | null;
}> = {}): Patient {
  return new Patient({
    id: 'patient-1',
    organizationId: 'org-1',
    nhc: '2026-00001',
    firstName: 'Test',
    lastName: 'Patient',
    birthDate: overrides.birthDate !== undefined ? overrides.birthDate : new Date('1984-03-12'),
    sex: 'MALE',
    createdBy: 'user-1',
    ageReferenceDate: overrides.ageReferenceDate,
    ageAtReferenceDate: overrides.ageAtReferenceDate,
  });
}

describe('Patient age fallback (spec §1)', () => {
  it('should derive age from birthDate when available', () => {
    const patient = makePatient({ birthDate: new Date('1984-03-12') });
    const result = patient.ageWithFallback();
    expect(result.provenance).toBe('birth-date');
    expect(result.age).toBe(patient.age());
  });

  it('should use reference date when birthDate is null', () => {
    // Reference date: 2024-01-15, age at that date: 40
    // Today is ~2026-09-12, so ~2.67 years elapsed → age ~42-43
    const patient = makePatient({
      birthDate: null,
      ageReferenceDate: { day: 15, month: 1, year: 2024 },
      ageAtReferenceDate: 40,
    });
    const result = patient.ageWithFallback();
    expect(result.provenance).toBe('reference-date');
    expect(result.age).not.toBeNull();
    expect(result.age).toBeGreaterThanOrEqual(42);
  });

  it('should return null when neither birthDate nor reference date is available', () => {
    const patient = makePatient({
      birthDate: null,
      ageReferenceDate: null,
      ageAtReferenceDate: null,
    });
    const result = patient.ageWithFallback();
    expect(result.provenance).toBe('none');
    expect(result.age).toBeNull();
  });

  it('should NOT fabricate a birth date when birthDate is null', () => {
    const patient = makePatient({
      birthDate: null,
      ageReferenceDate: { day: 1, month: 6, year: 2025 },
      ageAtReferenceDate: 55,
    });
    // birthDate must remain null — never invented
    expect(patient.birthDate).toBeNull();
    // age() returns null (no birth date)
    expect(patient.age()).toBeNull();
    // ageWithFallback uses the reference date path
    const result = patient.ageWithFallback();
    expect(result.provenance).toBe('reference-date');
  });

  it('should return null age when reference date is set but ageAtReferenceDate is null', () => {
    const patient = makePatient({
      birthDate: null,
      ageReferenceDate: { day: 1, month: 6, year: 2025 },
      ageAtReferenceDate: null,
    });
    const result = patient.ageWithFallback();
    expect(result.provenance).toBe('none');
    expect(result.age).toBeNull();
  });

  it('should preserve provenance visibility — caller can distinguish sources', () => {
    const withBirthDate = makePatient({ birthDate: new Date('1990-01-01') });
    const withRefDate = makePatient({
      birthDate: null,
      ageReferenceDate: { day: 1, month: 1, year: 2024 },
      ageAtReferenceDate: 30,
    });

    const r1 = withBirthDate.ageWithFallback();
    const r2 = withRefDate.ageWithFallback();

    // Different provenance labels — UI can show "Age calculated from reference date"
    expect(r1.provenance).not.toBe(r2.provenance);
    expect(r1.provenance).toBe('birth-date');
    expect(r2.provenance).toBe('reference-date');
  });
});
