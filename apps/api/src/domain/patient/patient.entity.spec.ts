// apps/api/src/domain/patient/patient.entity.spec.ts
import { describe, it, expect } from '@jest/globals';
import { Patient } from './patient.entity';

describe('Patient Entity', () => {
  const today = new Date('2026-06-10');

  function makePatient(overrides: Partial<{ birthDate: Date | null; allergies: any[]; deletedAt: Date | null }> = {}): Patient {
    return new Patient({
      id: 'patient-1',
      organizationId: 'org-1',
      nhc: '2026-00001',
      firstName: 'María',
      lastName: 'García López',
      birthDate: overrides.hasOwnProperty('birthDate') ? overrides.birthDate! : new Date('1984-03-12'),
      sex: 'FEMALE',
      phone: '+34612345678',
      email: 'maria@example.com',
      idDocument: '12345678A',
      idDocType: 'DNI',
      bloodType: 'A_POS',
      notes: 'Patient notes',
      address: { street: 'Calle Mayor 1', city: 'Madrid' },
      emergencyContact: { name: 'Juan García', relationship: 'spouse', phone: '+34612345679' },
      createdBy: 'user-1',
      allergies: overrides.allergies ?? [],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      deletedAt: overrides.deletedAt ?? null,
    });
  }

  describe('age calculation', () => {
    it('should calculate age from birthDate', () => {
      const patient = makePatient({ birthDate: new Date('1984-03-12') });
      // On 2026-06-10, someone born 1984-03-12 is 42
      const age = patient.age(today);
      expect(age).toBe(42);
    });

    it('should calculate age correctly when birthday has not yet occurred this year', () => {
      // Born Dec 1984, today is June 2026 → age is 41
      const patient = makePatient({ birthDate: new Date('1984-12-25') });
      const age = patient.age(today);
      expect(age).toBe(41);
    });
  });

  describe('age calculation with null birthDate (SDD import-data-quality)', () => {
    it('should return null age when birthDate is null', () => {
      const patient = makePatient({ birthDate: null as unknown as Date });
      expect(patient.age(today)).toBeNull();
    });

    it('should NOT be pediatric when birthDate is null (no age to compare)', () => {
      const patient = makePatient({ birthDate: null as unknown as Date });
      expect(patient.isPediatric(today)).toBe(false);
    });
  });

  describe('isPediatric (BR-PAT-007)', () => {
    it('should be pediatric when age < 14', () => {
      // Born 2015-01-01 → age 11 on 2026-06-10 → pediatric
      const patient = makePatient({ birthDate: new Date('2015-01-01') });
      expect(patient.isPediatric(today)).toBe(true);
    });

    it('should NOT be pediatric when age is exactly 14', () => {
      // Born 2012-06-10 → age 14 on 2026-06-10 → NOT pediatric
      const patient = makePatient({ birthDate: new Date('2012-06-10') });
      expect(patient.isPediatric(today)).toBe(false);
    });

    it('should NOT be pediatric when age > 14', () => {
      // Born 1984 → age 42 → NOT pediatric
      const patient = makePatient();
      expect(patient.isPediatric(today)).toBe(false);
    });
  });

  describe('hasCriticalAllergy (BR-PAT-006)', () => {
    it('should have critical allergy when ANAPHYLAXIS and ACTIVE', () => {
      const patient = makePatient({
        allergies: [
          { id: 'a1', patientId: 'patient-1', substance: 'Penicilina', severity: 'ANAPHYLAXIS', status: 'ACTIVE' },
        ],
      });
      expect(patient.hasCriticalAllergy).toBe(true);
    });

    it('should NOT have critical allergy when ANAPHYLAXIS but INACTIVE', () => {
      const patient = makePatient({
        allergies: [
          { id: 'a1', patientId: 'patient-1', substance: 'Penicilina', severity: 'ANAPHYLAXIS', status: 'INACTIVE' },
        ],
      });
      expect(patient.hasCriticalAllergy).toBe(false);
    });

    it('should NOT have critical allergy with SEVERE only', () => {
      const patient = makePatient({
        allergies: [
          { id: 'a1', patientId: 'patient-1', substance: 'Penicilina', severity: 'SEVERE', status: 'ACTIVE' },
        ],
      });
      expect(patient.hasCriticalAllergy).toBe(false);
    });

    it('should NOT have critical allergy with no allergies', () => {
      const patient = makePatient({ allergies: [] });
      expect(patient.hasCriticalAllergy).toBe(false);
    });
  });

  describe('hasActiveAllergies', () => {
    it('should be true when any allergy is ACTIVE', () => {
      const patient = makePatient({
        allergies: [
          { id: 'a1', patientId: 'patient-1', substance: 'Penicilina', severity: 'MILD', status: 'ACTIVE' },
        ],
      });
      expect(patient.hasActiveAllergies).toBe(true);
    });

    it('should be false when all allergies are INACTIVE', () => {
      const patient = makePatient({
        allergies: [
          { id: 'a1', patientId: 'patient-1', substance: 'Penicilina', severity: 'MILD', status: 'INACTIVE' },
        ],
      });
      expect(patient.hasActiveAllergies).toBe(false);
    });

    it('should be false with no allergies', () => {
      const patient = makePatient({ allergies: [] });
      expect(patient.hasActiveAllergies).toBe(false);
    });
  });

  describe('softDelete', () => {
    it('should set deletedAt to current date', () => {
      const patient = makePatient();
      expect(patient.deletedAt).toBeNull();
      const deleted = patient.softDelete();
      expect(deleted.deletedAt).not.toBeNull();
      expect(deleted.deletedAt instanceof Date).toBe(true);
    });
  });

  describe('anonymize', () => {
    it('should return anonymized patient data', () => {
      const patient = makePatient();
      const anon = patient.anonymize();
      expect(anon.firstName).toBe('***');
      expect(anon.lastName).toBe('***');
      expect(anon.phone).toBeNull();
      expect(anon.email).toBeNull();
      expect(anon.idDocument).toBeNull();
      expect(anon.address).toBeNull();
      expect(anon.nhc).toBe('2026-00001'); // NHC preserved for reference
    });
  });
});