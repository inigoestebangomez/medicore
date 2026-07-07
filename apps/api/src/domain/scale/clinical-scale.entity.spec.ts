// apps/api/src/domain/scale/clinical-scale.entity.spec.ts
import { describe, it, expect } from '@jest/globals';
import { ClinicalScale } from './clinical-scale.entity';

describe('ClinicalScale Entity', () => {
  function makeScale(overrides: Partial<{
    scaleType: 'SNOT_22' | 'DHI' | 'CUSTOM';
    scores: Record<string, number>;
    deletedAt: Date | null;
  }> = {}): ClinicalScale {
    return new ClinicalScale({
      id: 'scale-1',
      organizationId: 'org-1',
      patientId: 'patient-1',
      scaleType: overrides.scaleType ?? 'SNOT_22',
      date: new Date('2024-03-15'),
      scores: overrides.scores ?? { item_1: 3, item_2: 2 },
      createdBy: 'user-1',
      createdAt: new Date('2024-03-15'),
      updatedAt: new Date('2024-03-15'),
      deletedAt: overrides.deletedAt ?? null,
    });
  }

  describe('constructor', () => {
    it('should create scale with valid props', () => {
      const s = makeScale();
      expect(s.id).toBe('scale-1');
      expect(s.scaleType).toBe('SNOT_22');
      expect(s.scores).toEqual({ item_1: 3, item_2: 2 });
    });

    // SCA-002: Server-side total recalculation
    it('should calculate total from scores when total not provided', () => {
      const s = makeScale({ scores: { a: 5, b: 3, c: 2 } });
      expect(s.total).toBe(10);
    });

    it('should use provided total when explicitly set', () => {
      // This tests the edge case where total IS provided (constructor allows override)
      const s = new ClinicalScale({
        id: 'scale-1',
        organizationId: 'org-1',
        patientId: 'patient-1',
        scaleType: 'SNOT_22',
        date: new Date('2024-03-15'),
        scores: { a: 5, b: 3 },
        total: 99, // Client-sent total — should NOT be trusted in application layer
        createdBy: 'user-1',
      });
      // Note: the use case layer recalculates and overrides this
      // The entity constructor allows the total prop, but the create use case always recalculates
      expect(s.total).toBe(99);
    });

    it('should default nullable fields to null when omitted', () => {
      const s = new ClinicalScale({
        id: 'scale-1',
        organizationId: 'org-1',
        patientId: 'patient-1',
        scaleType: 'SNOT_22',
        date: new Date('2024-03-15'),
        scores: { item_1: 3 },
        createdBy: 'user-1',
      });
      expect(s.consultationId).toBeNull();
      expect(s.notes).toBeNull();
      expect(s.updatedBy).toBeNull();
      expect(s.auditLog).toBeNull();
      expect(s.deletedAt).toBeNull();
    });
  });

  describe('diffForUpdate', () => {
    it('returns audit entries for changed scores', () => {
      const s = makeScale({ scores: { a: 5, b: 3 } });
      const entries = s.diffForUpdate({ scores: { a: 4, b: 2 } }, 'user-2');
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('UPDATE');
      expect(entries[0].fieldDiffs![0].field).toBe('scores');
    });

    it('reports no changes when values are the same', () => {
      const s = makeScale();
      // Re-send identical scores + notes so diffForUpdate finds no actual changes
      const entries = s.diffForUpdate(
        { scores: { item_1: 3, item_2: 2 }, notes: null },
        'user-2',
      );
      expect(entries[0].details).toContain('No fields changed');
    });
  });

  describe('softDelete', () => {
    it('returns new instance with deletedAt set', () => {
      const s = makeScale();
      expect(s.deletedAt).toBeNull();
      const deleted = s.softDelete();
      expect(deleted.deletedAt).not.toBeNull();
      expect(deleted.deletedAt instanceof Date).toBe(true);
    });

    it('preserves all other fields', () => {
      const s = makeScale();
      const deleted = s.softDelete();
      expect(deleted.id).toBe(s.id);
      expect(deleted.scaleType).toBe(s.scaleType);
      expect(deleted.scores).toEqual(s.scores);
      expect(deleted.total).toBe(s.total);
    });
  });
});