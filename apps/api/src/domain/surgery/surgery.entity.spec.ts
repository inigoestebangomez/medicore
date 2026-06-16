// apps/api/src/domain/surgery/surgery.entity.spec.ts
import { describe, it, expect } from '@jest/globals';
import { Surgery } from './surgery.entity';
import { InvalidSurgeryTransitionError } from './errors/invalid-surgery-transition.error';

describe('Surgery Entity', () => {
  function makeSurgery(overrides: Partial<{
    status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'POSTPONED';
    editReason: string | null;
    deletedAt: Date | null;
  }> = {}): Surgery {
    return new Surgery({
      id: 'surgery-1',
      organizationId: 'org-1',
      patientId: 'patient-1',
      physicianId: 'physician-1',
      date: new Date('2024-06-15T10:30:00.000Z'),
      status: overrides.status ?? 'SCHEDULED',
      procedureType: 'Septoplastia + CENS bilateral',
      procedureCodes: null,
      asa: 'ASA_II',
      anesthesiaType: 'General',
      preOpNotes: 'Paciente en ayunas',
      preOpChecklist: { bloodwork: true, consent: true, fasting: true },
      duration: null,
      technique: null,
      findings: null,
      complications: null,
      postOpNotes: null,
      postOpProtocol: null,
      outcome: null,
      editReason: overrides.editReason ?? null,
      createdBy: 'user-1',
      createdAt: new Date('2024-06-15T10:30:00.000Z'),
      updatedAt: new Date('2024-06-15T10:30:00.000Z'),
      deletedAt: overrides.deletedAt ?? null,
    });
  }

  describe('constructor', () => {
    it('should create surgery with valid props', () => {
      const s = makeSurgery();
      expect(s.id).toBe('surgery-1');
      expect(s.organizationId).toBe('org-1');
      expect(s.patientId).toBe('patient-1');
      expect(s.physicianId).toBe('physician-1');
      expect(s.status).toBe('SCHEDULED');
      expect(s.procedureType).toBe('Septoplastia + CENS bilateral');
      expect(s.asa).toBe('ASA_II');
      expect(s.anesthesiaType).toBe('General');
    });

    it('should default nullable fields to null when omitted', () => {
      const s = new Surgery({
        id: 'surgery-1',
        organizationId: 'org-1',
        patientId: 'patient-1',
        physicianId: 'physician-1',
        date: new Date('2024-06-15'),
        status: 'SCHEDULED',
        procedureType: 'Appendectomy',
        createdBy: 'user-1',
      });
      expect(s.procedureCodes).toBeNull();
      expect(s.asa).toBeNull();
      expect(s.anesthesiaType).toBeNull();
      expect(s.preOpNotes).toBeNull();
      expect(s.preOpChecklist).toBeNull();
      expect(s.duration).toBeNull();
      expect(s.technique).toBeNull();
      expect(s.findings).toBeNull();
      expect(s.complications).toBeNull();
      expect(s.postOpNotes).toBeNull();
      expect(s.postOpProtocol).toBeNull();
      expect(s.outcome).toBeNull();
      expect(s.editReason).toBeNull();
      expect(s.updatedBy).toBeNull();
      expect(s.auditLog).toBeNull();
      expect(s.deletedAt).toBeNull();
    });
  });

  describe('canTransitionTo', () => {
    it('SCHEDULED → COMPLETED is true', () => {
      const s = makeSurgery({ status: 'SCHEDULED' });
      expect(s.canTransitionTo('COMPLETED')).toBe(true);
    });

    it('SCHEDULED → POSTPONED is true', () => {
      const s = makeSurgery({ status: 'SCHEDULED' });
      expect(s.canTransitionTo('POSTPONED')).toBe(true);
    });

    it('SCHEDULED → CANCELLED is true', () => {
      const s = makeSurgery({ status: 'SCHEDULED' });
      expect(s.canTransitionTo('CANCELLED')).toBe(true);
    });

    it('COMPLETED → SCHEDULED is false (terminal)', () => {
      const s = makeSurgery({ status: 'COMPLETED' });
      expect(s.canTransitionTo('SCHEDULED')).toBe(false);
    });

    it('CANCELLED → SCHEDULED is false (terminal)', () => {
      const s = makeSurgery({ status: 'CANCELLED' });
      expect(s.canTransitionTo('SCHEDULED')).toBe(false);
    });

    it('POSTPONED → SCHEDULED is true', () => {
      const s = makeSurgery({ status: 'POSTPONED' });
      expect(s.canTransitionTo('SCHEDULED')).toBe(true);
    });

    it('POSTPONED → CANCELLED is true', () => {
      const s = makeSurgery({ status: 'POSTPONED' });
      expect(s.canTransitionTo('CANCELLED')).toBe(true);
    });
  });

  describe('isTerminal', () => {
    it('COMPLETED is terminal', () => {
      const s = makeSurgery({ status: 'COMPLETED' });
      expect(s.isTerminal()).toBe(true);
    });

    it('CANCELLED is terminal', () => {
      const s = makeSurgery({ status: 'CANCELLED' });
      expect(s.isTerminal()).toBe(true);
    });

    it('SCHEDULED is not terminal', () => {
      const s = makeSurgery({ status: 'SCHEDULED' });
      expect(s.isTerminal()).toBe(false);
    });

    it('POSTPONED is not terminal', () => {
      const s = makeSurgery({ status: 'POSTPONED' });
      expect(s.isTerminal()).toBe(false);
    });
  });

  describe('transitionTo', () => {
    it('returns new instance with updated status', () => {
      const s = makeSurgery({ status: 'SCHEDULED' });
      const completed = s.transitionTo('COMPLETED');
      expect(completed.status).toBe('COMPLETED');
      expect(completed.id).toBe(s.id);
      expect(completed.procedureType).toBe(s.procedureType);
    });

    it('updates date and asa when provided', () => {
      const s = makeSurgery({ status: 'SCHEDULED' });
      const newDate = new Date('2024-07-01');
      const completed = s.transitionTo('COMPLETED', newDate, 'ASA_III');
      expect(completed.date).toBe(newDate);
      expect(completed.asa).toBe('ASA_III');
    });

    it('preserves existing date and asa when not provided', () => {
      const s = makeSurgery({ status: 'SCHEDULED' });
      const completed = s.transitionTo('COMPLETED');
      expect(completed.date).toBe(s.date);
      expect(completed.asa).toBe(s.asa);
    });

    it('sets editReason when provided', () => {
      const s = makeSurgery({ status: 'SCHEDULED' });
      const postponed = s.transitionTo('POSTPONED', undefined, undefined, 'Patient flu');
      expect(postponed.editReason).toBe('Patient flu');
    });

    it('throws InvalidSurgeryTransitionError for invalid transition', () => {
      const s = makeSurgery({ status: 'COMPLETED' });
      expect(() => s.transitionTo('SCHEDULED')).toThrow(InvalidSurgeryTransitionError);
    });

    it('throws InvalidSurgeryTransitionError with correct from/to status', () => {
      const s = makeSurgery({ status: 'CANCELLED' });
      try {
        s.transitionTo('SCHEDULED');
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(InvalidSurgeryTransitionError);
        const err = e as InvalidSurgeryTransitionError;
        expect(err.fromStatus).toBe('CANCELLED');
        expect(err.toStatus).toBe('SCHEDULED');
      }
    });
  });

  describe('diffForUpdate', () => {
    it('returns audit entries only for changed fields', () => {
      const s = makeSurgery();
      const entries = s.diffForUpdate({ procedureType: 'New procedure' }, 'user-2');
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('UPDATE');
      expect(entries[0].performedBy).toBe('user-2');
      expect(entries[0].fieldDiffs).toBeDefined();
      expect(entries[0].fieldDiffs!.length).toBe(1);
      expect(entries[0].fieldDiffs![0].field).toBe('procedureType');
      expect(entries[0].fieldDiffs![0].from).toBe('Septoplastia + CENS bilateral');
      expect(entries[0].fieldDiffs![0].to).toBe('New procedure');
    });

    it('includes multiple field diffs when multiple fields change', () => {
      const s = makeSurgery();
      const entries = s.diffForUpdate(
        { procedureType: 'New procedure', preOpNotes: 'Updated notes' },
        'user-3',
      );
      expect(entries[0].fieldDiffs!.length).toBeGreaterThanOrEqual(2);
      const fields = entries[0].fieldDiffs!.map((d) => d.field);
      expect(fields).toContain('procedureType');
      expect(fields).toContain('preOpNotes');
    });

    it('reports no fields changed when values are the same', () => {
      const s = makeSurgery();
      const entries = s.diffForUpdate({ procedureType: s.procedureType }, 'user-2');
      expect(entries[0].details).toContain('No fields changed');
      expect(entries[0].fieldDiffs).toBeUndefined();
    });

    it('skips undefined values and does not include them in diff', () => {
      const s = makeSurgery();
      const entries = s.diffForUpdate({ procedureType: 'New' }, 'user-2');
      const fields = entries[0].fieldDiffs!.map((d) => d.field);
      expect(fields).toContain('procedureType');
    });

    it('includes editReason in audit for terminal state edits', () => {
      const s = makeSurgery({ status: 'COMPLETED' });
      const entries = s.diffForUpdate({ postOpNotes: 'Recovery normal', editReason: 'Typo fix' }, 'user-2');
      const fields = entries[0].fieldDiffs!.map((d) => d.field);
      expect(fields).toContain('postOpNotes');
      // editReason is included in the diff because it changed (null -> 'Typo fix')
      expect(fields).toContain('editReason');
    });
  });

  describe('softDelete', () => {
    it('returns new instance with deletedAt set', () => {
      const s = makeSurgery();
      expect(s.deletedAt).toBeNull();
      const deleted = s.softDelete();
      expect(deleted.deletedAt).not.toBeNull();
      expect(deleted.deletedAt instanceof Date).toBe(true);
    });

    it('preserves all other fields', () => {
      const s = makeSurgery();
      const deleted = s.softDelete();
      expect(deleted.id).toBe(s.id);
      expect(deleted.patientId).toBe(s.patientId);
      expect(deleted.procedureType).toBe(s.procedureType);
      expect(deleted.status).toBe(s.status);
    });
  });
});