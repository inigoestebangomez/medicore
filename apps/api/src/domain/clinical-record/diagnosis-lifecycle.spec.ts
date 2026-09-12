// apps/api/src/domain/clinical-record/diagnosis-lifecycle.spec.ts
// Tests for diagnosis status lifecycle (spec §6):
// active/resolved/discarded state; discarded excluded from active stats but retained for audit.
import { describe, it, expect } from '@jest/globals';
import { Diagnosis } from './diagnosis/diagnosis.entity';

function makeDiagnosis(overrides: Partial<{
  status: 'ACTIVE' | 'RESOLVED' | 'DISCARDED';
}> = {}): Diagnosis {
  return new Diagnosis({
    id: 'dx-1',
    organizationId: 'org-1',
    patientId: 'patient-1',
    system: 'CIE-10-ES',
    code: 'J32.0',
    description: 'Chronic maxillary sinusitis',
    catalogVersion: '2024',
    status: overrides.status ?? 'ACTIVE',
    variables: {},
    sourceType: 'manual',
    authorId: 'user-1',
    recordedAt: new Date('2026-09-12'),
  });
}

describe('Diagnosis lifecycle (spec §6)', () => {
  describe('status', () => {
    it('should default to ACTIVE', () => {
      const dx = makeDiagnosis();
      expect(dx.status).toBe('ACTIVE');
      expect(dx.isActive).toBe(true);
    });

    it('should accept RESOLVED', () => {
      const dx = makeDiagnosis({ status: 'RESOLVED' });
      expect(dx.status).toBe('RESOLVED');
      expect(dx.isActive).toBe(false);
    });

    it('should accept DISCARDED', () => {
      const dx = makeDiagnosis({ status: 'DISCARDED' });
      expect(dx.status).toBe('DISCARDED');
      expect(dx.isActive).toBe(false);
    });
  });

  describe('resolve()', () => {
    it('should transition from ACTIVE to RESOLVED', () => {
      const dx = makeDiagnosis({ status: 'ACTIVE' });
      const resolved = dx.resolve();
      expect(resolved.status).toBe('RESOLVED');
      expect(resolved.resolvedAt).not.toBeNull();
    });

    it('should throw when resolving a non-ACTIVE diagnosis', () => {
      const dx = makeDiagnosis({ status: 'RESOLVED' });
      expect(() => dx.resolve()).toThrow('Cannot resolve');
    });

    it('should be immutable', () => {
      const dx = makeDiagnosis({ status: 'ACTIVE' });
      dx.resolve();
      expect(dx.status).toBe('ACTIVE'); // original unchanged
    });
  });

  describe('discard()', () => {
    it('should transition from ACTIVE to DISCARDED', () => {
      const dx = makeDiagnosis({ status: 'ACTIVE' });
      const discarded = dx.discard('reviewer-1');
      expect(discarded.status).toBe('DISCARDED');
      expect(discarded.discardedAt).not.toBeNull();
      expect(discarded.discardedBy).toBe('reviewer-1');
    });

    it('should throw when discarding a non-ACTIVE diagnosis', () => {
      const dx = makeDiagnosis({ status: 'DISCARDED' });
      expect(() => dx.discard('reviewer-1')).toThrow('Cannot discard');
    });

    it('should be excluded from active statistics but retained for audit', () => {
      const active = makeDiagnosis({ status: 'ACTIVE' });
      const discarded = makeDiagnosis({ status: 'DISCARDED' });

      expect(active.isActive).toBe(true);
      expect(discarded.isActive).toBe(false);
      // Discarded diagnosis still exists with all data for audit
      expect(discarded.code).toBe('J32.0');
      expect(discarded.description).toBe('Chronic maxillary sinusitis');
    });
  });

  describe('catalog validation', () => {
    it('should store the catalog version used for validation', () => {
      const dx = makeDiagnosis();
      expect(dx.catalogVersion).toBe('2024');
    });

    it('should store the code system', () => {
      const dx = makeDiagnosis();
      expect(dx.system).toBe('CIE-10-ES');
    });

    it('should accept SNOMED system', () => {
      const dx = new Diagnosis({
        id: 'dx-2',
        organizationId: 'org-1',
        patientId: 'patient-1',
        system: 'SNOMED',
        code: '36971009',
        description: 'Chronic sinusitis',
        catalogVersion: '2024-01',
        status: 'ACTIVE',
        variables: {},
        sourceType: 'manual',
        authorId: 'user-1',
        recordedAt: new Date('2026-09-12'),
      });
      expect(dx.system).toBe('SNOMED');
    });
  });
});
