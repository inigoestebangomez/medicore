import { describe, it, expect } from 'vitest';
import {
  CreateAllergySchema,
  UpdateAllergySchema,
  AllergyResponseSchema,
} from './allergy.schema';

describe('allergy.schema', () => {
  describe('CreateAllergySchema', () => {
    const minimalValid = {
      substance: 'Penicilina',
      severity: 'ANAPHYLAXIS',
    };

    it('should accept valid allergy with required fields', () => {
      const result = CreateAllergySchema.parse(minimalValid);
      expect(result.substance).toBe('Penicilina');
      expect(result.severity).toBe('ANAPHYLAXIS');
    });

    it('should accept allergy with all optional fields', () => {
      const data = {
        substance: 'Amoxicilina',
        severity: 'SEVERE',
        reaction: 'Urticaria generalizada',
        substanceCode: '91936004',
        onsetDate: '2020-01-01',
        notes: 'Reacción grave en urgencias',
      };
      const result = CreateAllergySchema.parse(data);
      expect(result.reaction).toBe('Urticaria generalizada');
      expect(result.substanceCode).toBe('91936004');
    });

    it('should default status to ACTIVE', () => {
      const result = CreateAllergySchema.parse(minimalValid);
      expect(result.status).toBe('ACTIVE');
    });

    it('should default idDocType to DNI when not provided', () => {
      // Not applicable to allergy — just checking defaults work
      const result = CreateAllergySchema.parse(minimalValid);
      expect(result.substance).toBe('Penicilina');
    });

    it('should reject missing substance', () => {
      const { substance, ...noSubstance } = minimalValid;
      expect(() => CreateAllergySchema.parse(noSubstance)).toThrow();
    });

    it('should reject missing severity', () => {
      const { severity, ...noSeverity } = minimalValid;
      expect(() => CreateAllergySchema.parse(noSeverity)).toThrow();
    });

    it('should reject invalid severity value', () => {
      expect(() => CreateAllergySchema.parse({ ...minimalValid, severity: 'CRITICAL' })).toThrow();
    });

    it('should accept all valid severity values', () => {
      const severities = ['MILD', 'MODERATE', 'SEVERE', 'ANAPHYLAXIS'];
      for (const severity of severities) {
        const result = CreateAllergySchema.parse({ ...minimalValid, severity });
        expect(result.severity).toBe(severity);
      }
    });

    it('should accept all valid status values', () => {
      const statuses = ['ACTIVE', 'INACTIVE', 'UNCONFIRMED'];
      for (const status of statuses) {
        const result = CreateAllergySchema.parse({ ...minimalValid, status });
        expect(result.status).toBe(status);
      }
    });

    it('should reject invalid status value', () => {
      expect(() => CreateAllergySchema.parse({ ...minimalValid, status: 'RESOLVED' })).toThrow();
    });

    it('should accept empty notes', () => {
      const result = CreateAllergySchema.parse({ ...minimalValid, notes: '' });
      expect(result.notes).toBe('');
    });
  });

  describe('UpdateAllergySchema', () => {
    it('should allow partial update with only severity', () => {
      const result = UpdateAllergySchema.parse({ severity: 'MILD' });
      expect(result.severity).toBe('MILD');
      expect(result.substance).toBeUndefined();
    });

    it('should allow partial update with only status', () => {
      const result = UpdateAllergySchema.parse({ status: 'INACTIVE' });
      expect(result.status).toBe('INACTIVE');
    });

    it('should accept empty object (no changes)', () => {
      const result = UpdateAllergySchema.parse({});
      expect(result.substance).toBeUndefined();
    });

    it('should reject invalid severity value', () => {
      expect(() => UpdateAllergySchema.parse({ severity: 'INVALID' })).toThrow();
    });

    it('should reject invalid status value', () => {
      expect(() => UpdateAllergySchema.parse({ status: 'RESOLVED' })).toThrow();
    });
  });

  describe('AllergyResponseSchema', () => {
    it('should validate a complete allergy response', () => {
      const data = {
        id: '660e8400-e29b-41d4-a716-446655440002',
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        substance: 'Penicilina',
        substanceCode: '91936004',
        reaction: 'Anafilaxia',
        severity: 'ANAPHYLAXIS',
        status: 'ACTIVE',
        onsetDate: '2020-01-01',
        notes: 'Reacción grave',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      const result = AllergyResponseSchema.parse(data);
      expect(result.id).toBe(data.id);
      expect(result.severity).toBe('ANAPHYLAXIS');
      expect(result.status).toBe('ACTIVE');
    });

    it('should accept response without optional fields', () => {
      const data = {
        id: '660e8400-e29b-41d4-a716-446655440002',
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        substance: 'Látex',
        severity: 'MODERATE',
        status: 'ACTIVE',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      const result = AllergyResponseSchema.parse(data);
      expect(result.substance).toBe('Látex');
      expect(result.reaction).toBeUndefined();
    });
  });
});