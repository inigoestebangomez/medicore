import { describe, it, expect } from 'vitest';
import {
  SurgeryStatusSchema,
  AsaClassificationSchema,
  CreateSurgerySchema,
  UpdateSurgerySchema,
  ChangeSurgeryStatusSchema,
  SurgeryResponseSchema,
  ListSurgeriesQuerySchema,
  ALLOWED_TRANSITIONS,
} from './surgery.schema';

describe('surgery.schema', () => {
  // ─────────────────────────────────────────────
  // SurgeryStatusSchema
  // ─────────────────────────────────────────────

  describe('SurgeryStatusSchema', () => {
    it('should accept all valid statuses', () => {
      for (const status of ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'POSTPONED'] as const) {
        const result = SurgeryStatusSchema.parse(status);
        expect(result).toBe(status);
      }
    });

    it('should reject invalid status', () => {
      expect(() => SurgeryStatusSchema.parse('IN_PROGRESS')).toThrow();
    });

    it('should reject empty string', () => {
      expect(() => SurgeryStatusSchema.parse('')).toThrow();
    });
  });

  // ─────────────────────────────────────────────
  // AsaClassificationSchema
  // ─────────────────────────────────────────────

  describe('AsaClassificationSchema', () => {
    it('should accept all valid ASA classifications', () => {
      for (const asa of ['ASA_I', 'ASA_II', 'ASA_III', 'ASA_IV', 'ASA_V', 'ASA_VI'] as const) {
        const result = AsaClassificationSchema.parse(asa);
        expect(result).toBe(asa);
      }
    });

    it('should reject invalid ASA classification', () => {
      expect(() => AsaClassificationSchema.parse('ASA_VII')).toThrow();
    });

    it('should reject numeric ASA value', () => {
      expect(() => AsaClassificationSchema.parse('3')).toThrow();
    });
  });

  // ─────────────────────────────────────────────
  // CreateSurgerySchema
  // ─────────────────────────────────────────────

  describe('CreateSurgerySchema', () => {
    const minimalValid = {
      date: '2024-06-15T08:00:00.000Z',
      procedureType: 'Appendectomy',
    };

    it('should accept minimum required fields', () => {
      const result = CreateSurgerySchema.parse(minimalValid);
      expect(result.date).toBe('2024-06-15T08:00:00.000Z');
      expect(result.procedureType).toBe('Appendectomy');
      expect(result.generateReport).toBe(false); // default
      expect(result.procedureCodes).toBeUndefined();
      expect(result.asa).toBeUndefined();
    });

    it('should default generateReport to false', () => {
      const result = CreateSurgerySchema.parse(minimalValid);
      expect(result.generateReport).toBe(false);
    });

    it('should accept full payload with all fields', () => {
      const data = {
        date: '2024-06-15T08:00:00.000Z',
        procedureType: 'Total Knee Replacement',
        procedureCodes: [
          { system: 'CPT' as const, code: '27447', description: 'Total knee arthroplasty' },
        ],
        asa: 'ASA_III' as const,
        anesthesiaType: 'General',
        preOpNotes: 'Patient cleared for surgery',
        preOpChecklist: { labs: true, consent: true },
        duration: 120,
        technique: { approach: 'anterior' },
        findings: 'Degenerative joint disease',
        complications: 'None',
        postOpNotes: 'Recovering well',
        postOpProtocol: { mobilization: 'day-1' },
        outcome: 'Successful',
        generateReport: true,
      };
      const result = CreateSurgerySchema.parse(data);
      expect(result.procedureCodes).toHaveLength(1);
      expect(result.asa).toBe('ASA_III');
      expect(result.anesthesiaType).toBe('General');
      expect(result.duration).toBe(120);
      expect(result.generateReport).toBe(true);
      expect(result.preOpChecklist).toEqual({ labs: true, consent: true });
      expect(result.technique).toEqual({ approach: 'anterior' });
      expect(result.postOpProtocol).toEqual({ mobilization: 'day-1' });
    });

    it('should reject missing date', () => {
      const { date, ...noDate } = minimalValid;
      expect(() => CreateSurgerySchema.parse(noDate)).toThrow();
    });

    it('should reject missing procedureType', () => {
      const { procedureType, ...noType } = minimalValid;
      expect(() => CreateSurgerySchema.parse(noType)).toThrow();
    });

    it('should reject empty procedureType', () => {
      expect(() => CreateSurgerySchema.parse({ ...minimalValid, procedureType: '' })).toThrow();
    });

    it('should reject procedureType over 500 chars', () => {
      expect(() => CreateSurgerySchema.parse({ ...minimalValid, procedureType: 'x'.repeat(501) })).toThrow();
    });

    it('should reject invalid datetime', () => {
      expect(() => CreateSurgerySchema.parse({ ...minimalValid, date: 'not-a-date' })).toThrow();
    });

    it('should reject procedure codes array over 20', () => {
      const procs = Array.from({ length: 21 }, (_, i) => ({
        system: 'CPT' as const,
        code: `${i}`,
        description: `Proc ${i}`,
      }));
      expect(() => CreateSurgerySchema.parse({ ...minimalValid, procedureCodes: procs })).toThrow();
    });

    it('should accept procedure codes array at max 20', () => {
      const procs = Array.from({ length: 20 }, (_, i) => ({
        system: 'CPT' as const,
        code: `${i}`,
        description: `Proc ${i}`,
      }));
      const result = CreateSurgerySchema.parse({ ...minimalValid, procedureCodes: procs });
      expect(result.procedureCodes).toHaveLength(20);
    });

    it('should reject invalid ASA classification', () => {
      expect(() => CreateSurgerySchema.parse({ ...minimalValid, asa: 'ASA_VII' })).toThrow();
    });

    it('should reject non-positive duration', () => {
      expect(() => CreateSurgerySchema.parse({ ...minimalValid, duration: 0 })).toThrow();
      expect(() => CreateSurgerySchema.parse({ ...minimalValid, duration: -1 })).toThrow();
    });

    it('should reject non-integer duration', () => {
      expect(() => CreateSurgerySchema.parse({ ...minimalValid, duration: 1.5 })).toThrow();
    });

    it('should accept valid ASA classification', () => {
      const result = CreateSurgerySchema.parse({ ...minimalValid, asa: 'ASA_II' });
      expect(result.asa).toBe('ASA_II');
    });
  });

  // ─────────────────────────────────────────────
  // UpdateSurgerySchema
  // ─────────────────────────────────────────────

  describe('UpdateSurgerySchema', () => {
    it('should allow partial update with one field', () => {
      const result = UpdateSurgerySchema.parse({ procedureType: 'Updated procedure' });
      expect(result.procedureType).toBe('Updated procedure');
      expect(result.date).toBeUndefined();
    });

    it('should allow empty object (no changes)', () => {
      const result = UpdateSurgerySchema.parse({});
      expect(result.procedureType).toBeUndefined();
    });

    it('should allow nullable fields to clear values', () => {
      const result = UpdateSurgerySchema.parse({
        anesthesiaType: null,
        preOpNotes: null,
        asa: null,
        findings: null,
      });
      expect(result.anesthesiaType).toBeNull();
      expect(result.preOpNotes).toBeNull();
      expect(result.asa).toBeNull();
      expect(result.findings).toBeNull();
    });

    it('should accept editReason with content', () => {
      const result = UpdateSurgerySchema.parse({ editReason: 'Corrected procedure type' });
      expect(result.editReason).toBe('Corrected procedure type');
    });

    it('should reject editReason shorter than 1 char', () => {
      expect(() => UpdateSurgerySchema.parse({ editReason: '' })).toThrow();
    });

    it('should reject editReason over 2000 chars', () => {
      expect(() => UpdateSurgerySchema.parse({ editReason: 'x'.repeat(2001) })).toThrow();
    });

    it('should reject empty procedureType if provided', () => {
      expect(() => UpdateSurgerySchema.parse({ procedureType: '' })).toThrow();
    });

    it('should reject invalid datetime for date', () => {
      expect(() => UpdateSurgerySchema.parse({ date: 'not-a-date' })).toThrow();
    });

    it('should allow valid date update', () => {
      const result = UpdateSurgerySchema.parse({ date: '2024-07-01T10:00:00.000Z' });
      expect(result.date).toBe('2024-07-01T10:00:00.000Z');
    });

    it('should allow nullable preOpChecklist', () => {
      const result = UpdateSurgerySchema.parse({ preOpChecklist: null });
      expect(result.preOpChecklist).toBeNull();
    });

    it('should allow updating preOpChecklist with data', () => {
      const result = UpdateSurgerySchema.parse({ preOpChecklist: { labs: true } });
      expect(result.preOpChecklist).toEqual({ labs: true });
    });
  });

  // ─────────────────────────────────────────────
  // ChangeSurgeryStatusSchema
  // ─────────────────────────────────────────────

  describe('ChangeSurgeryStatusSchema', () => {
    it('should accept valid status transition', () => {
      const result = ChangeSurgeryStatusSchema.parse({
        targetStatus: 'COMPLETED',
        asa: 'ASA_II',
      });
      expect(result.targetStatus).toBe('COMPLETED');
      expect(result.asa).toBe('ASA_II');
    });

    it('should require targetStatus', () => {
      expect(() => ChangeSurgeryStatusSchema.parse({})).toThrow();
    });

    it('should accept targetStatus with statusReason', () => {
      const result = ChangeSurgeryStatusSchema.parse({
        targetStatus: 'CANCELLED',
        statusReason: 'Patient withdrew consent',
      });
      expect(result.statusReason).toBe('Patient withdrew consent');
    });

    it('should accept targetStatus with date', () => {
      const result = ChangeSurgeryStatusSchema.parse({
        targetStatus: 'POSTPONED',
        date: '2024-08-01T08:00:00.000Z',
      });
      expect(result.date).toBe('2024-08-01T08:00:00.000Z');
    });

    it('should reject invalid targetStatus', () => {
      expect(() => ChangeSurgeryStatusSchema.parse({ targetStatus: 'IN_PROGRESS' })).toThrow();
    });

    it('should reject statusReason over 2000 chars', () => {
      expect(() => ChangeSurgeryStatusSchema.parse({
        targetStatus: 'CANCELLED',
        statusReason: 'x'.repeat(2001),
      })).toThrow();
    });

    it('should accept without optional asa', () => {
      const result = ChangeSurgeryStatusSchema.parse({ targetStatus: 'SCHEDULED' });
      expect(result.asa).toBeUndefined();
    });

    it('should reject invalid ASA classification', () => {
      expect(() => ChangeSurgeryStatusSchema.parse({
        targetStatus: 'COMPLETED',
        asa: 'ASA_VII',
      })).toThrow();
    });
  });

  // ─────────────────────────────────────────────
  // SurgeryResponseSchema
  // ─────────────────────────────────────────────

  describe('SurgeryResponseSchema', () => {
    const validResponse = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      patientId: '660e8400-e29b-41d4-a716-446655440001',
      organizationId: '770e8400-e29b-41d4-a716-446655440002',
      date: '2024-06-15T08:00:00.000Z',
      status: 'COMPLETED',
      procedureType: 'Appendectomy',
      procedureCodes: [
        { system: 'CPT', code: '44970', description: 'Laparoscopic appendectomy' },
      ],
      asa: 'ASA_II',
      anesthesiaType: 'General',
      preOpNotes: 'Patient cleared',
      preOpChecklist: { labs: true, consent: true },
      duration: 90,
      technique: { approach: 'laparoscopic' },
      findings: 'Acute appendicitis',
      complications: null,
      postOpNotes: 'Recovering well',
      postOpProtocol: { mobilization: 'day-1' },
      outcome: 'Successful',
      editReason: null,
      physicianId: 'physician-1',
      createdBy: 'user-1',
      updatedBy: null,
      createdAt: '2024-06-15T08:00:00.000Z',
      updatedAt: '2024-06-15T10:30:00.000Z',
    };

    it('should validate a complete surgery response', () => {
      const result = SurgeryResponseSchema.parse(validResponse);
      expect(result.id).toBe(validResponse.id);
      expect(result.status).toBe('COMPLETED');
      expect(result.asa).toBe('ASA_II');
      expect(result.procedureCodes).toHaveLength(1);
      expect(result.duration).toBe(90);
    });

    it('should accept response with nullable fields set to null', () => {
      const data = {
        ...validResponse,
        procedureCodes: null,
        asa: null,
        anesthesiaType: null,
        preOpNotes: null,
        preOpChecklist: null,
        duration: null,
        technique: null,
        findings: null,
        complications: null,
        postOpNotes: null,
        postOpProtocol: null,
        outcome: null,
        editReason: null,
        updatedBy: null,
      };
      const result = SurgeryResponseSchema.parse(data);
      expect(result.procedureCodes).toBeNull();
      expect(result.asa).toBeNull();
      expect(result.duration).toBeNull();
    });

    it('should accept response with optional consentWarning', () => {
      const result = SurgeryResponseSchema.parse({ ...validResponse, consentWarning: true });
      expect(result.consentWarning).toBe(true);
    });

    it('should accept response with optional reportQueued', () => {
      const result = SurgeryResponseSchema.parse({ ...validResponse, reportQueued: true });
      expect(result.reportQueued).toBe(true);
    });

    it('should accept response without optional consentWarning and reportQueued', () => {
      // These fields are not in validResponse by default
      const result = SurgeryResponseSchema.parse(validResponse);
      expect(result.consentWarning).toBeUndefined();
      expect(result.reportQueued).toBeUndefined();
    });

    it('should reject response missing required id', () => {
      const { id, ...withoutId } = validResponse;
      expect(() => SurgeryResponseSchema.parse(withoutId)).toThrow();
    });

    it('should reject response with invalid UUID id', () => {
      expect(() => SurgeryResponseSchema.parse({ ...validResponse, id: 'not-uuid' })).toThrow();
    });

    it('should reject response with invalid UUID patientId', () => {
      expect(() => SurgeryResponseSchema.parse({ ...validResponse, patientId: 'not-uuid' })).toThrow();
    });

    it('should reject response with invalid status', () => {
      expect(() => SurgeryResponseSchema.parse({ ...validResponse, status: 'IN_PROGRESS' })).toThrow();
    });
  });

  // ─────────────────────────────────────────────
  // ListSurgeriesQuerySchema
  // ─────────────────────────────────────────────

  describe('ListSurgeriesQuerySchema', () => {
    it('should accept empty query with defaults', () => {
      const result = ListSurgeriesQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.sortBy).toBe('date');
      expect(result.sortOrder).toBe('desc');
    });

    it('should accept custom pagination', () => {
      const result = ListSurgeriesQuerySchema.parse({ page: 2, pageSize: 50 });
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(50);
    });

    it('should reject pageSize over 100', () => {
      expect(() => ListSurgeriesQuerySchema.parse({ pageSize: 101 })).toThrow();
    });

    it('should reject page less than 1', () => {
      expect(() => ListSurgeriesQuerySchema.parse({ page: 0 })).toThrow();
    });

    it('should accept date range filters', () => {
      const result = ListSurgeriesQuerySchema.parse({
        from: '2024-01-01T00:00:00.000Z',
        to: '2024-12-31T23:59:59.000Z',
      });
      expect(result.from).toBe('2024-01-01T00:00:00.000Z');
      expect(result.to).toBe('2024-12-31T23:59:59.000Z');
    });

    it('should accept status filter', () => {
      for (const status of ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'POSTPONED'] as const) {
        const result = ListSurgeriesQuerySchema.parse({ status });
        expect(result.status).toBe(status);
      }
    });

    it('should reject invalid status filter', () => {
      expect(() => ListSurgeriesQuerySchema.parse({ status: 'IN_PROGRESS' })).toThrow();
    });

    it('should accept all valid sortBy values', () => {
      for (const sortBy of ['date', 'createdAt'] as const) {
        const result = ListSurgeriesQuerySchema.parse({ sortBy });
        expect(result.sortBy).toBe(sortBy);
      }
    });

    it('should accept all valid sortOrder values', () => {
      for (const sortOrder of ['asc', 'desc'] as const) {
        const result = ListSurgeriesQuerySchema.parse({ sortOrder });
        expect(result.sortOrder).toBe(sortOrder);
      }
    });

    it('should reject invalid sortBy', () => {
      expect(() => ListSurgeriesQuerySchema.parse({ sortBy: 'status' })).toThrow();
    });

    it('should reject invalid sortOrder', () => {
      expect(() => ListSurgeriesQuerySchema.parse({ sortOrder: 'random' })).toThrow();
    });

    it('should coerce string page to number', () => {
      const result = ListSurgeriesQuerySchema.parse({ page: '3', pageSize: '10' });
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
    });
  });

  // ─────────────────────────────────────────────
  // ALLOWED_TRANSITIONS
  // ─────────────────────────────────────────────

  describe('ALLOWED_TRANSITIONS', () => {
    it('should have SCHEDULED with 3 transitions', () => {
      expect(ALLOWED_TRANSITIONS.SCHEDULED).toEqual(['COMPLETED', 'CANCELLED', 'POSTPONED']);
      expect(ALLOWED_TRANSITIONS.SCHEDULED).toHaveLength(3);
    });

    it('should have POSTPONED with 2 transitions', () => {
      expect(ALLOWED_TRANSITIONS.POSTPONED).toEqual(['SCHEDULED', 'CANCELLED']);
      expect(ALLOWED_TRANSITIONS.POSTPONED).toHaveLength(2);
    });

    it('should have COMPLETED as terminal state (0 transitions)', () => {
      expect(ALLOWED_TRANSITIONS.COMPLETED).toEqual([]);
      expect(ALLOWED_TRANSITIONS.COMPLETED).toHaveLength(0);
    });

    it('should have CANCELLED as terminal state (0 transitions)', () => {
      expect(ALLOWED_TRANSITIONS.CANCELLED).toEqual([]);
      expect(ALLOWED_TRANSITIONS.CANCELLED).toHaveLength(0);
    });

    it('should be a plain object (not a Zod schema)', () => {
      expect(typeof ALLOWED_TRANSITIONS).toBe('object');
      expect(ALLOWED_TRANSITIONS).not.toHaveProperty('parse');
      expect(ALLOWED_TRANSITIONS).not.toHaveProperty('safeParse');
    });
  });
});