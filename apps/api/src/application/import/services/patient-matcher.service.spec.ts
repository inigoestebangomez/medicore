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