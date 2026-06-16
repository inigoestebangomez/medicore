// apps/api/src/domain/consultation/consultation.entity.spec.ts
import { describe, it, expect } from '@jest/globals';
import { Consultation } from './consultation.entity';

describe('Consultation Entity', () => {
  function makeConsultation(overrides: Partial<{
    followUpDate: Date | null;
    diagnosisCodes: Array<{ system: 'ICD10' | 'SNOMED'; code: string; description: string; type: 'primary' | 'secondary' | 'differential' }>;
    deletedAt: Date | null;
    type: 'FIRST_VISIT' | 'FOLLOW_UP' | 'URGENCY' | 'POST_OP' | 'TELECONSULTATION';
  }> = {}): Consultation {
    return new Consultation({
      id: 'consultation-1',
      patientId: 'patient-1',
      organizationId: 'org-1',
      date: new Date('2024-06-15T10:30:00.000Z'),
      type: overrides.type ?? 'FIRST_VISIT',
      physicianId: 'physician-1',
      physicianName: 'Dr. García',
      chiefComplaint: 'Persistent headache for 3 days',
      currentIllness: 'Chronic migraine',
      physicalExam: { bp: '120/80', hr: 78 },
      assessment: 'Migraine without aura',
      diagnosisCodes: overrides.diagnosisCodes ?? [],
      plan: 'Continue topiramate',
      createdBy: 'user-1',
      createdAt: new Date('2024-06-15T10:30:00.000Z'),
      updatedAt: new Date('2024-06-15T10:30:00.000Z'),
      deletedAt: overrides.deletedAt ?? null,
      followUpDate: overrides.followUpDate ?? null,
    });
  }

  describe('constructor', () => {
    it('should create consultation with all fields', () => {
      const c = makeConsultation();
      expect(c.id).toBe('consultation-1');
      expect(c.patientId).toBe('patient-1');
      expect(c.organizationId).toBe('org-1');
      expect(c.type).toBe('FIRST_VISIT');
      expect(c.physicianId).toBe('physician-1');
      expect(c.chiefComplaint).toBe('Persistent headache for 3 days');
    });

    it('should default nullable fields to null when omitted', () => {
      const props = {
        id: 'consultation-1',
        patientId: 'patient-1',
        organizationId: 'org-1',
        date: new Date('2024-06-15T10:30:00.000Z'),
        type: 'FIRST_VISIT' as const,
        physicianId: 'physician-1',
        chiefComplaint: 'Headache',
        createdBy: 'user-1',
      };
      const c = new Consultation(props);
      expect(c.currentIllness).toBeNull();
      expect(c.assessment).toBeNull();
      expect(c.followUpDate).toBeNull();
      expect(c.followUpNotes).toBeNull();
      expect(c.physicalExam).toBeNull();
      expect(c.plan).toBeNull();
    });

    it('should default array fields to empty arrays', () => {
      const c = makeConsultation();
      expect(c.diagnosisCodes).toEqual([]);
      expect(c.procedureCodes).toEqual([]);
    });

    it('should preserve provided diagnosisCodes', () => {
      const codes = [
        { system: 'ICD10' as const, code: 'G43.909', description: 'Migraine', type: 'primary' as const },
      ];
      const c = makeConsultation({ diagnosisCodes: codes });
      expect(c.diagnosisCodes).toHaveLength(1);
      expect(c.diagnosisCodes[0].type).toBe('primary');
    });
  });

  describe('isFollowUpScheduled', () => {
    it('should be false when followUpDate is null', () => {
      const c = makeConsultation({ followUpDate: null });
      expect(c.isFollowUpScheduled).toBe(false);
    });

    it('should be true when followUpDate is set', () => {
      const c = makeConsultation({ followUpDate: new Date('2024-07-15') });
      expect(c.isFollowUpScheduled).toBe(true);
    });
  });

  describe('hasPrimaryDiagnosis', () => {
    it('should be false when no diagnosis codes', () => {
      const c = makeConsultation({ diagnosisCodes: [] });
      expect(c.hasPrimaryDiagnosis).toBe(false);
    });

    it('should be false when only secondary codes', () => {
      const c = makeConsultation({
        diagnosisCodes: [
          { system: 'ICD10', code: 'E11.9', description: 'DM2', type: 'secondary' },
        ],
      });
      expect(c.hasPrimaryDiagnosis).toBe(false);
    });

    it('should be true when a primary code exists', () => {
      const c = makeConsultation({
        diagnosisCodes: [
          { system: 'ICD10', code: 'G43.909', description: 'Migraine', type: 'primary' },
          { system: 'ICD10', code: 'E11.9', description: 'DM2', type: 'secondary' },
        ],
      });
      expect(c.hasPrimaryDiagnosis).toBe(true);
    });
  });

  describe('diffForUpdate', () => {
    it('should include updatedBy and changed fields', () => {
      const c = makeConsultation();
      const diff = c.diffForUpdate({ chiefComplaint: 'Updated complaint' }, 'user-2');
      expect(diff.updatedBy).toBe('user-2');
      expect(diff.chiefComplaint).toBe('Updated complaint');
    });

    it('should include fieldDiffs in audit log for changed fields', () => {
      const c = makeConsultation();
      const diff = c.diffForUpdate({ chiefComplaint: 'Updated complaint' }, 'user-2') as any;
      expect(diff.auditLog).toBeDefined();
      expect(diff.auditLog.action).toBe('UPDATE');
      expect(diff.auditLog.performedBy).toBe('user-2');
      expect(diff.auditLog.fieldDiffs).toBeDefined();
      expect(diff.auditLog.fieldDiffs).toHaveLength(1);
      expect(diff.auditLog.fieldDiffs[0].field).toBe('chiefComplaint');
      expect(diff.auditLog.fieldDiffs[0].from).toBe('Persistent headache for 3 days');
      expect(diff.auditLog.fieldDiffs[0].to).toBe('Updated complaint');
      expect(diff.auditLog.fieldDiffs[0].userId).toBe('user-2');
      expect(diff.auditLog.fieldDiffs[0].timestamp).toBeDefined();
    });

    it('should produce multiple fieldDiffs when multiple fields change', () => {
      const c = makeConsultation();
      const diff = c.diffForUpdate({ chiefComplaint: 'New complaint', plan: 'New plan' }, 'user-3') as any;
      expect(diff.auditLog.fieldDiffs).toHaveLength(2);
      expect(diff.auditLog.fieldDiffs.map((fd: any) => fd.field)).toContain('chiefComplaint');
      expect(diff.auditLog.fieldDiffs.map((fd: any) => fd.field)).toContain('plan');
    });

    it('should not produce fieldDiffs for unchanged fields', () => {
      const c = makeConsultation();
      const sameComplaint = c.chiefComplaint;
      const diff = c.diffForUpdate({ chiefComplaint: sameComplaint }, 'user-2') as any;
      expect(diff.auditLog.fieldDiffs).toBeUndefined();
      expect(diff.auditLog.details).toContain('No fields changed');
    });

    it('should skip undefined values and not include them in diff', () => {
      const c = makeConsultation();
      const diff = c.diffForUpdate({ chiefComplaint: 'New', plan: undefined }, 'user-2');
      expect(diff.chiefComplaint).toBe('New');
      expect(diff).not.toHaveProperty('plan');
    });

    it('should not include immutable fields even if passed', () => {
      const c = makeConsultation();
      const diff = c.diffForUpdate({}, 'user-2');
      expect(diff.updatedBy).toBe('user-2');
      expect(diff).not.toHaveProperty('id');
      expect(diff).not.toHaveProperty('patientId');
    });

    it('should include from/to with null values in fieldDiffs', () => {
      const c = makeConsultation();
      // Use followUpNotes which is null in makeConsultation's default props
      const diff = c.diffForUpdate({ followUpNotes: 'Return in 2 weeks' }, 'user-5') as any;
      expect(diff.auditLog.fieldDiffs).toHaveLength(1);
      expect(diff.auditLog.fieldDiffs[0].field).toBe('followUpNotes');
      expect(diff.auditLog.fieldDiffs[0].from).toBeNull();
      expect(diff.auditLog.fieldDiffs[0].to).toBe('Return in 2 weeks');
    });
  });

  describe('softDelete', () => {
    it('should set deletedAt to current date', () => {
      const c = makeConsultation();
      expect(c.deletedAt).toBeNull();
      const deleted = c.softDelete();
      expect(deleted.deletedAt).not.toBeNull();
      expect(deleted.deletedAt instanceof Date).toBe(true);
    });

    it('should preserve all other fields', () => {
      const c = makeConsultation();
      const deleted = c.softDelete();
      expect(deleted.id).toBe(c.id);
      expect(deleted.patientId).toBe(c.patientId);
      expect(deleted.chiefComplaint).toBe(c.chiefComplaint);
      expect(deleted.type).toBe(c.type);
    });
  });
});