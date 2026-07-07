// apps/api/src/domain/medication/medication.entity.spec.ts
import { describe, it, expect } from '@jest/globals';
import { Medication } from './medication.entity';
import { InvalidMedicationTransitionError } from './errors/invalid-medication-transition.error';
import { MissingDiscontinuationReasonError } from './errors/missing-discontinuation-reason.error';

describe('MedicationPrescription Entity', () => {
  function makeMedication(overrides: Partial<{
    status: 'ACTIVE' | 'DISCONTINUED' | 'COMPLETED' | 'ON_HOLD';
    discontinuationReason: string | null;
    deletedAt: Date | null;
  }> = {}): Medication {
    return new Medication({
      id: 'med-1',
      organizationId: 'org-1',
      patientId: 'patient-1',
      physicianId: 'physician-1',
      drugName: 'Amoxicillin',
      dosage: '500mg',
      frequency: 'every 8 hours',
      startDate: new Date('2024-01-01'),
      status: overrides.status ?? 'ACTIVE',
      discontinuationReason: overrides.discontinuationReason ?? null,
      createdBy: 'user-1',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      deletedAt: overrides.deletedAt ?? null,
    });
  }

  describe('constructor', () => {
    it('should create medication with valid props', () => {
      const m = makeMedication();
      expect(m.id).toBe('med-1');
      expect(m.organizationId).toBe('org-1');
      expect(m.patientId).toBe('patient-1');
      expect(m.drugName).toBe('Amoxicillin');
      expect(m.dosage).toBe('500mg');
      expect(m.frequency).toBe('every 8 hours');
      expect(m.status).toBe('ACTIVE');
    });

    it('should default nullable fields to null when omitted', () => {
      const m = new Medication({
        id: 'med-1',
        organizationId: 'org-1',
        patientId: 'patient-1',
        physicianId: 'physician-1',
        drugName: 'Amoxicillin',
        dosage: '500mg',
        frequency: 'every 8 hours',
        startDate: new Date('2024-01-01'),
        status: 'ACTIVE',
        createdBy: 'user-1',
      });
      expect(m.consultationId).toBeNull();
      expect(m.drugCode).toBeNull();
      expect(m.activeIngredient).toBeNull();
      expect(m.route).toBeNull();
      expect(m.form).toBeNull();
      expect(m.endDate).toBeNull();
      expect(m.duration).toBeNull();
      expect(m.instructions).toBeNull();
      expect(m.reason).toBeNull();
      expect(m.discontinuationReason).toBeNull();
      expect(m.updatedBy).toBeNull();
      expect(m.auditLog).toBeNull();
      expect(m.deletedAt).toBeNull();
    });
  });

  // MED-001: State machine transitions
  describe('canTransitionTo', () => {
    it('ACTIVE → DISCONTINUED is true', () => {
      const m = makeMedication({ status: 'ACTIVE' });
      expect(m.canTransitionTo('DISCONTINUED')).toBe(true);
    });

    it('ACTIVE → COMPLETED is true', () => {
      const m = makeMedication({ status: 'ACTIVE' });
      expect(m.canTransitionTo('COMPLETED')).toBe(true);
    });

    it('ACTIVE → ON_HOLD is true', () => {
      const m = makeMedication({ status: 'ACTIVE' });
      expect(m.canTransitionTo('ON_HOLD')).toBe(true);
    });

    it('ON_HOLD → ACTIVE is true', () => {
      const m = makeMedication({ status: 'ON_HOLD' });
      expect(m.canTransitionTo('ACTIVE')).toBe(true);
    });

    it('ON_HOLD → DISCONTINUED is true', () => {
      const m = makeMedication({ status: 'ON_HOLD' });
      expect(m.canTransitionTo('DISCONTINUED')).toBe(true);
    });

    it('DISCONTINUED → ACTIVE is false (terminal)', () => {
      const m = makeMedication({ status: 'DISCONTINUED' });
      expect(m.canTransitionTo('ACTIVE')).toBe(false);
    });

    it('COMPLETED → any is false (terminal)', () => {
      const m = makeMedication({ status: 'COMPLETED' });
      expect(m.canTransitionTo('ACTIVE')).toBe(false);
      expect(m.canTransitionTo('DISCONTINUED')).toBe(false);
    });
  });

  describe('isTerminal', () => {
    it('DISCONTINUED is terminal', () => {
      const m = makeMedication({ status: 'DISCONTINUED' });
      expect(m.isTerminal()).toBe(true);
    });

    it('COMPLETED is terminal', () => {
      const m = makeMedication({ status: 'COMPLETED' });
      expect(m.isTerminal()).toBe(true);
    });

    it('ACTIVE is not terminal', () => {
      const m = makeMedication({ status: 'ACTIVE' });
      expect(m.isTerminal()).toBe(false);
    });

    it('ON_HOLD is not terminal', () => {
      const m = makeMedication({ status: 'ON_HOLD' });
      expect(m.isTerminal()).toBe(false);
    });
  });

  describe('transitionTo', () => {
    it('returns new instance with DISCONTINUED status and reason', () => {
      const m = makeMedication({ status: 'ACTIVE' });
      const result = m.transitionTo('DISCONTINUED', 'Adverse reaction');
      expect(result.status).toBe('DISCONTINUED');
      expect(result.discontinuationReason).toBe('Adverse reaction');
      expect(result.id).toBe(m.id);
    });

    it('returns new instance with COMPLETED status', () => {
      const m = makeMedication({ status: 'ACTIVE' });
      const result = m.transitionTo('COMPLETED');
      expect(result.status).toBe('COMPLETED');
      expect(result.discontinuationReason).toBeNull();
    });

    it('throws InvalidMedicationTransitionError for invalid transition', () => {
      const m = makeMedication({ status: 'COMPLETED' });
      expect(() => m.transitionTo('ACTIVE')).toThrow(InvalidMedicationTransitionError);
    });

    // MED-003: Discontinuation requires reason
    it('throws MissingDiscontinuationReasonError when discontinuing without reason', () => {
      const m = makeMedication({ status: 'ACTIVE' });
      expect(() => m.transitionTo('DISCONTINUED')).toThrow(MissingDiscontinuationReasonError);
    });

    it('throws MissingDiscontinuationReasonError when reason is empty string', () => {
      const m = makeMedication({ status: 'ACTIVE' });
      expect(() => m.transitionTo('DISCONTINUED', '')).toThrow(MissingDiscontinuationReasonError);
    });
  });

  describe('diffForUpdate', () => {
    it('returns audit entries only for changed fields', () => {
      const m = makeMedication();
      const entries = m.diffForUpdate({ drugName: 'Ibuprofen' }, 'user-2');
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('UPDATE');
      expect(entries[0].performedBy).toBe('user-2');
      expect(entries[0].fieldDiffs).toBeDefined();
      expect(entries[0].fieldDiffs!.length).toBe(1);
      expect(entries[0].fieldDiffs![0].field).toBe('drugName');
      expect(entries[0].fieldDiffs![0].from).toBe('Amoxicillin');
      expect(entries[0].fieldDiffs![0].to).toBe('Ibuprofen');
    });

    it('reports no fields changed when values are the same', () => {
      const m = makeMedication();
      const entries = m.diffForUpdate({ drugName: m.drugName }, 'user-2');
      expect(entries[0].details).toContain('No fields changed');
      expect(entries[0].fieldDiffs).toBeUndefined();
    });
  });

  describe('softDelete', () => {
    it('returns new instance with deletedAt set', () => {
      const m = makeMedication();
      expect(m.deletedAt).toBeNull();
      const deleted = m.softDelete();
      expect(deleted.deletedAt).not.toBeNull();
      expect(deleted.deletedAt instanceof Date).toBe(true);
    });

    it('preserves all other fields', () => {
      const m = makeMedication();
      const deleted = m.softDelete();
      expect(deleted.id).toBe(m.id);
      expect(deleted.drugName).toBe(m.drugName);
      expect(deleted.status).toBe(m.status);
    });
  });
});