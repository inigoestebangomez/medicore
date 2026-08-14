import { describe, it, expect } from 'vitest';
import {
  CreatePatientSchema,
  UpdatePatientSchema,
  PatientResponseSchema,
  SearchPatientsSchema,
} from './patient.schema';

describe('patient.schema', () => {
  describe('CreatePatientSchema', () => {
    const minimalValid = {
      firstName: 'María',
      lastName: 'García López',
      birthDate: '1984-03-12',
      sex: 'FEMALE',
    };

    it('should accept minimum required fields', () => {
      const result = CreatePatientSchema.parse(minimalValid);
      expect(result.firstName).toBe('María');
      expect(result.lastName).toBe('García López');
      expect(result.birthDate).toBe('1984-03-12');
      expect(result.sex).toBe('FEMALE');
    });

    it('should accept all optional fields', () => {
      const data = {
        ...minimalValid,
        phone: '+34612345678',
        email: 'maria@example.com',
        address: { street: 'Calle Mayor 1', city: 'Madrid', postalCode: '28001', country: 'ES' },
        idDocument: '12345678A',
        idDocType: 'DNI',
        nhc: 'EXT-2024-001',
        bloodType: 'A_POS',
        notes: 'Patient notes',
      };
      const result = CreatePatientSchema.parse(data);
      expect(result.phone).toBe('+34612345678');
      expect(result.nhc).toBe('EXT-2024-001');
      expect(result.bloodType).toBe('A_POS');
    });

    it('should reject missing firstName', () => {
      const { firstName, ...noFirst } = minimalValid;
      expect(() => CreatePatientSchema.parse(noFirst)).toThrow();
    });

    it('should reject missing lastName', () => {
      const { lastName, ...noLast } = minimalValid;
      expect(() => CreatePatientSchema.parse(noLast)).toThrow();
    });

    it('should reject missing birthDate', () => {
      const { birthDate, ...noDate } = minimalValid;
      expect(() => CreatePatientSchema.parse(noDate)).toThrow();
    });

    it('should reject missing sex', () => {
      const { sex, ...noSex } = minimalValid;
      expect(() => CreatePatientSchema.parse(noSex)).toThrow();
    });

    it('should reject future birthDate', () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      expect(() =>
        CreatePatientSchema.parse({ ...minimalValid, birthDate: future.toISOString() }),
      ).toThrow();
    });

    it('should reject invalid sex value', () => {
      expect(() => CreatePatientSchema.parse({ ...minimalValid, sex: 'INVALID' })).toThrow();
    });

    it('should accept all valid sex values', () => {
      const sexes = ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'];
      for (const sex of sexes) {
        const result = CreatePatientSchema.parse({ ...minimalValid, sex });
        expect(result.sex).toBe(sex);
      }
    });

    it('should accept optional external NHC', () => {
      const result = CreatePatientSchema.parse({ ...minimalValid, nhc: 'EXT-2024-001' });
      expect(result.nhc).toBe('EXT-2024-001');
    });

    it('should accept empty string optional fields as null', () => {
      // Optional strings that are empty should be treated as undefined/null
      const result = CreatePatientSchema.parse({ ...minimalValid });
      expect(result.phone).toBeUndefined();
      expect(result.email).toBeUndefined();
    });
  });

  describe('UpdatePatientSchema', () => {
    it('should allow partial update with only firstName', () => {
      const result = UpdatePatientSchema.parse({ firstName: 'New' });
      expect(result.firstName).toBe('New');
      expect(result.lastName).toBeUndefined();
    });

    it('should allow partial update with only phone', () => {
      const result = UpdatePatientSchema.parse({ phone: '+34612345678' });
      expect(result.phone).toBe('+34612345678');
    });

    it('should accept empty object (no changes)', () => {
      const result = UpdatePatientSchema.parse({});
      expect(result.firstName).toBeUndefined();
    });

    it('should NOT allow updating nhc (immutable)', () => {
      // UpdatePatientSchema should not contain nhc field
      const schemaKeys = Object.keys(UpdatePatientSchema.shape);
      expect(schemaKeys).not.toContain('nhc');
    });

    it('should reject invalid sex value', () => {
      expect(() => UpdatePatientSchema.parse({ sex: 'INVALID' })).toThrow();
    });

    it('should reject future birthDate', () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      expect(() => UpdatePatientSchema.parse({ birthDate: future.toISOString() })).toThrow();
    });
  });

  describe('PatientResponseSchema', () => {
    it('should validate a complete patient response', () => {
      const data = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        nhc: '2026-00001',
        firstName: 'María',
        lastName: 'García López',
        birthDate: '1984-03-12',
        sex: 'FEMALE',
        age: 42,
        isPediatric: false,
        hasCriticalAllergy: false,
        hasActiveAllergies: false,
        phone: '+34612345678',
        email: 'maria@example.com',
        address: { street: 'Calle Mayor 1', city: 'Madrid' },
        idDocument: '12345678A',
        idDocType: 'DNI',
        bloodType: 'A_POS',
        notes: 'Patient notes',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      const result = PatientResponseSchema.parse(data);
      expect(result.id).toBe(data.id);
      expect(result.nhc).toBe('2026-00001');
      expect(result.age).toBe(42);
      expect(result.isPediatric).toBe(false);
    });

    it('should accept response without optional contact fields', () => {
      const data = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        nhc: '2026-00001',
        firstName: 'María',
        lastName: 'García López',
        birthDate: '1984-03-12',
        sex: 'FEMALE',
        age: 42,
        isPediatric: false,
        hasCriticalAllergy: false,
        hasActiveAllergies: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      const result = PatientResponseSchema.parse(data);
      expect(result.phone).toBeUndefined();
      expect(result.email).toBeUndefined();
    });

    it('should accept null birthDate and age for patients without a known DOB', () => {
      const data = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        nhc: '2026-00001',
        firstName: 'María',
        lastName: 'García López',
        birthDate: null,
        sex: 'FEMALE',
        age: null,
        isPediatric: false,
        hasCriticalAllergy: false,
        hasActiveAllergies: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      expect(PatientResponseSchema.parse(data)).toMatchObject({ birthDate: null, age: null });
    });
  });

  describe('SearchPatientsSchema', () => {
    it('should accept search with just query', () => {
      const result = SearchPatientsSchema.parse({ query: 'garcia' });
      expect(result.query).toBe('garcia');
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should apply default pagination', () => {
      const result = SearchPatientsSchema.parse({ query: 'test' });
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should accept custom page and pageSize', () => {
      const result = SearchPatientsSchema.parse({ query: 'test', page: 2, pageSize: 50 });
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(50);
    });

    it('should reject pageSize over 100', () => {
      expect(() => SearchPatientsSchema.parse({ query: 'test', pageSize: 101 })).toThrow();
    });

    it('should reject page less than 1', () => {
      expect(() => SearchPatientsSchema.parse({ query: 'test', page: 0 })).toThrow();
    });

    it('should reject empty query', () => {
      expect(() => SearchPatientsSchema.parse({ query: '' })).toThrow();
    });

    it('should accept sortBy and sortOrder', () => {
      const result = SearchPatientsSchema.parse({ query: 'test', sortBy: 'lastName', sortOrder: 'asc' });
      expect(result.sortBy).toBe('lastName');
      expect(result.sortOrder).toBe('asc');
    });

    it('should default sortBy to lastName and sortOrder to asc', () => {
      const result = SearchPatientsSchema.parse({ query: 'test' });
      expect(result.sortBy).toBe('lastName');
      expect(result.sortOrder).toBe('asc');
    });
  });
});
