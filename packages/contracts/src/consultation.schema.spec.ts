import { describe, it, expect } from 'vitest';
import {
  ConsultationTypeSchema,
  DiagnosisCodeSchema,
  DiagnosisCodesArraySchema,
  ProcedureCodeSchema,
  CreateConsultationSchema,
  UpdateConsultationSchema,
  ConsultationResponseSchema,
  ListConsultationsQuerySchema,
  ConsultationListItemSchema,
  SearchConsultationLogsSchema,
} from './consultation.schema';

describe('consultation.schema', () => {
  // ─────────────────────────────────────────────
  // ConsultationTypeSchema
  // ─────────────────────────────────────────────

  describe('ConsultationTypeSchema', () => {
    it('should accept all valid consultation types', () => {
      const types = ['FIRST_VISIT', 'FOLLOW_UP', 'URGENCY', 'POST_OP', 'TELECONSULTATION'];
      for (const type of types) {
        const result = ConsultationTypeSchema.parse(type);
        expect(result).toBe(type);
      }
    });

    it('should reject invalid consultation type', () => {
      expect(() => ConsultationTypeSchema.parse('ROUTINE')).toThrow();
    });
  });

  // ─────────────────────────────────────────────
  // DiagnosisCodeSchema
  // ─────────────────────────────────────────────

  describe('DiagnosisCodeSchema', () => {
    const validCode = {
      system: 'ICD10' as const,
      code: 'J06.9',
      description: 'Acute upper respiratory infection',
      type: 'primary' as const,
    };

    it('should accept a valid diagnosis code', () => {
      const result = DiagnosisCodeSchema.parse(validCode);
      expect(result.system).toBe('ICD10');
      expect(result.code).toBe('J06.9');
      expect(result.type).toBe('primary');
    });

    it('should accept diagnosis code with optional notes', () => {
      const result = DiagnosisCodeSchema.parse({ ...validCode, notes: 'Recurrent' });
      expect(result.notes).toBe('Recurrent');
    });

    it('should accept SNOMED system', () => {
      const result = DiagnosisCodeSchema.parse({ ...validCode, system: 'SNOMED' });
      expect(result.system).toBe('SNOMED');
    });

    it('should accept all valid types', () => {
      for (const type of ['primary', 'secondary', 'differential'] as const) {
        const result = DiagnosisCodeSchema.parse({ ...validCode, type });
        expect(result.type).toBe(type);
      }
    });

    it('should reject empty code', () => {
      expect(() => DiagnosisCodeSchema.parse({ ...validCode, code: '' })).toThrow();
    });

    it('should reject empty description', () => {
      expect(() => DiagnosisCodeSchema.parse({ ...validCode, description: '' })).toThrow();
    });

    it('should reject invalid system', () => {
      expect(() => DiagnosisCodeSchema.parse({ ...validCode, system: 'INVALID' })).toThrow();
    });

    it('should reject invalid type', () => {
      expect(() => DiagnosisCodeSchema.parse({ ...validCode, type: 'tertiary' })).toThrow();
    });
  });

  // ─────────────────────────────────────────────
  // DiagnosisCodesArraySchema
  // ─────────────────────────────────────────────

  describe('DiagnosisCodesArraySchema', () => {
    it('should accept an empty array', () => {
      const result = DiagnosisCodesArraySchema.parse([]);
      expect(result).toEqual([]);
    });

    it('should accept a single primary diagnosis', () => {
      const codes = [
        { system: 'ICD10', code: 'J06.9', description: 'URI', type: 'primary' as const },
      ];
      const result = DiagnosisCodesArraySchema.parse(codes);
      expect(result).toHaveLength(1);
    });

    it('should accept a mix of primary and secondary diagnoses', () => {
      const codes = [
        { system: 'ICD10', code: 'J06.9', description: 'URI', type: 'primary' as const },
        { system: 'ICD10', code: 'E11.9', description: 'Type 2 DM', type: 'secondary' as const },
      ];
      const result = DiagnosisCodesArraySchema.parse(codes);
      expect(result).toHaveLength(2);
    });

    it('should reject more than 10 diagnosis codes', () => {
      const codes = Array.from({ length: 11 }, (_, i) => ({
        system: 'ICD10' as const,
        code: `C${i}`,
        description: `Code ${i}`,
        type: 'secondary' as const,
      }));
      expect(() => DiagnosisCodesArraySchema.parse(codes)).toThrow();
    });

    it('should reject multiple primary diagnoses', () => {
      const codes = [
        { system: 'ICD10', code: 'J06.9', description: 'URI', type: 'primary' as const },
        { system: 'ICD10', code: 'E11.9', description: 'DM', type: 'primary' as const },
      ];
      expect(() => DiagnosisCodesArraySchema.parse(codes)).toThrow();
    });

    it('should accept exactly 10 diagnosis codes', () => {
      const codes = Array.from({ length: 10 }, (_, i) => ({
        system: 'ICD10' as const,
        code: `C${i}`,
        description: `Code ${i}`,
        type: i === 0 ? 'primary' as const : 'secondary' as const,
      }));
      const result = DiagnosisCodesArraySchema.parse(codes);
      expect(result).toHaveLength(10);
    });
  });

  // ─────────────────────────────────────────────
  // ProcedureCodeSchema
  // ─────────────────────────────────────────────

  describe('ProcedureCodeSchema', () => {
    const validProc = {
      system: 'CPT' as const,
      code: '99213',
      description: 'Office visit',
    };

    it('should accept a valid procedure code', () => {
      const result = ProcedureCodeSchema.parse(validProc);
      expect(result.system).toBe('CPT');
      expect(result.code).toBe('99213');
    });

    it('should accept optional laterality', () => {
      const result = ProcedureCodeSchema.parse({ ...validProc, laterality: 'left' });
      expect(result.laterality).toBe('left');
    });

    it('should accept optional notes', () => {
      const result = ProcedureCodeSchema.parse({ ...validProc, notes: 'Under sedation' });
      expect(result.notes).toBe('Under sedation');
    });

    it('should accept all valid systems', () => {
      for (const system of ['ICD10PCS', 'SNOMED', 'CPT'] as const) {
        const result = ProcedureCodeSchema.parse({ ...validProc, system });
        expect(result.system).toBe(system);
      }
    });

    it('should accept all valid laterality values', () => {
      for (const laterality of ['left', 'right', 'bilateral', 'na'] as const) {
        const result = ProcedureCodeSchema.parse({ ...validProc, laterality });
        expect(result.laterality).toBe(laterality);
      }
    });

    it('should reject empty code', () => {
      expect(() => ProcedureCodeSchema.parse({ ...validProc, code: '' })).toThrow();
    });

    it('should reject invalid system', () => {
      expect(() => ProcedureCodeSchema.parse({ ...validProc, system: 'INVALID' })).toThrow();
    });
  });

  // ─────────────────────────────────────────────
  // CreateConsultationSchema
  // ─────────────────────────────────────────────

  describe('CreateConsultationSchema', () => {
    const now = new Date();
    const pastDate = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const futureDate = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();

    const minimalValid = {
      date: pastDate,
      chiefComplaint: 'Patient reports persistent headache for 3 days',
    };

    it('should accept minimum required fields', () => {
      const result = CreateConsultationSchema.parse(minimalValid);
      expect(result.chiefComplaint).toBe('Patient reports persistent headache for 3 days');
      expect(result.type).toBe('FIRST_VISIT'); // default
      expect(result.generateReport).toBe(false); // default
    });

    it('should default type to FIRST_VISIT', () => {
      const result = CreateConsultationSchema.parse(minimalValid);
      expect(result.type).toBe('FIRST_VISIT');
    });

    it('should default generateReport to false', () => {
      const result = CreateConsultationSchema.parse(minimalValid);
      expect(result.generateReport).toBe(false);
    });

    it('should accept all fields', () => {
      const data = {
        date: pastDate,
        type: 'FOLLOW_UP' as const,
        chiefComplaint: 'Follow-up on hypertension',
        currentIllness: 'Chronic HTN',
        physicalExam: { bp: '140/90', hr: 80 },
        assessment: 'Hypertension controlled',
        diagnosisCodes: [
          { system: 'ICD10' as const, code: 'I10', description: 'Essential hypertension', type: 'primary' as const },
        ],
        plan: 'Continue medication',
        procedureCodes: [
          { system: 'CPT' as const, code: '99213', description: 'Office visit' },
        ],
        followUpDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        followUpNotes: 'Review in 30 days',
        generateReport: true,
      };
      const result = CreateConsultationSchema.parse(data);
      expect(result.type).toBe('FOLLOW_UP');
      expect(result.generateReport).toBe(true);
      expect(result.diagnosisCodes).toHaveLength(1);
      expect(result.procedureCodes).toHaveLength(1);
    });

    it('should accept all valid consultation types', () => {
      const types = ['FIRST_VISIT', 'FOLLOW_UP', 'URGENCY', 'POST_OP', 'TELECONSULTATION'];
      for (const type of types) {
        const result = CreateConsultationSchema.parse({ ...minimalValid, type });
        expect(result.type).toBe(type);
      }
    });

    it('should reject missing date', () => {
      const { date, ...noDate } = minimalValid;
      expect(() => CreateConsultationSchema.parse(noDate)).toThrow();
    });

    it('should reject missing chiefComplaint', () => {
      const { chiefComplaint, ...noComplaint } = minimalValid;
      expect(() => CreateConsultationSchema.parse(noComplaint)).toThrow();
    });

    it('should reject chiefComplaint shorter than 3 chars', () => {
      expect(() => CreateConsultationSchema.parse({ ...minimalValid, chiefComplaint: 'ab' })).toThrow();
    });

    it('should reject chiefComplaint longer than 2000 chars', () => {
      expect(() => CreateConsultationSchema.parse({ ...minimalValid, chiefComplaint: 'a'.repeat(2001) })).toThrow();
    });

    it('should reject date more than 24 hours in the future', () => {
      const farFuture = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();
      expect(() => CreateConsultationSchema.parse({ ...minimalValid, date: farFuture })).toThrow();
    });

    it('should accept date within 24 hours from now', () => {
      const result = CreateConsultationSchema.parse({ ...minimalValid, date: futureDate });
      expect(result.date).toBe(futureDate);
    });

    it('should accept invalid datetime string gracefully via datetime validation', () => {
      expect(() => CreateConsultationSchema.parse({ ...minimalValid, date: 'not-a-date' })).toThrow();
    });

    it('should reject procedure codes array over 10', () => {
      const procs = Array.from({ length: 11 }, (_, i) => ({
        system: 'CPT' as const,
        code: `${i}`,
        description: `Proc ${i}`,
      }));
      expect(() => CreateConsultationSchema.parse({ ...minimalValid, procedureCodes: procs })).toThrow();
    });

    it('should reject diagnosis codes with multiple primary', () => {
      const diagCodes = [
        { system: 'ICD10' as const, code: 'J06.9', description: 'URI', type: 'primary' as const },
        { system: 'ICD10' as const, code: 'E11.9', description: 'DM2', type: 'primary' as const },
      ];
      expect(() => CreateConsultationSchema.parse({ ...minimalValid, diagnosisCodes: diagCodes })).toThrow();
    });
  });

  // ─────────────────────────────────────────────
  // UpdateConsultationSchema
  // ─────────────────────────────────────────────

  describe('UpdateConsultationSchema', () => {
    it('should allow partial update with only chiefComplaint', () => {
      const result = UpdateConsultationSchema.parse({ chiefComplaint: 'Updated complaint' });
      expect(result.chiefComplaint).toBe('Updated complaint');
      expect(result.type).toBeUndefined();
    });

    it('should allow empty object (no changes)', () => {
      const result = UpdateConsultationSchema.parse({});
      expect(result.chiefComplaint).toBeUndefined();
    });

    it('should allow nullable fields to clear values', () => {
      const result = UpdateConsultationSchema.parse({ currentIllness: null });
      expect(result.currentIllness).toBeNull();
    });

    it('should reject invalid consultation type', () => {
      expect(() => UpdateConsultationSchema.parse({ type: 'INVALID' })).toThrow();
    });

    it('should reject chiefComplaint shorter than 3 chars', () => {
      expect(() => UpdateConsultationSchema.parse({ chiefComplaint: 'ab' })).toThrow();
    });

    it('should reject date more than 24 hours in the future', () => {
      const farFuture = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();
      expect(() => UpdateConsultationSchema.parse({ date: farFuture })).toThrow();
    });

    it('should accept valid date in update', () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const result = UpdateConsultationSchema.parse({ date: pastDate });
      expect(result.date).toBe(pastDate);
    });

    it('should allow updating type alone', () => {
      const result = UpdateConsultationSchema.parse({ type: 'FOLLOW_UP' });
      expect(result.type).toBe('FOLLOW_UP');
    });

    it('should allow nullable physicalExam to clear', () => {
      const result = UpdateConsultationSchema.parse({ physicalExam: null });
      expect(result.physicalExam).toBeNull();
    });
  });

  // ─────────────────────────────────────────────
  // ConsultationResponseSchema
  // ─────────────────────────────────────────────

  describe('ConsultationResponseSchema', () => {
    const validResponse = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      patientId: '660e8400-e29b-41d4-a716-446655440001',
      organizationId: '770e8400-e29b-41d4-a716-446655440002',
      date: '2024-01-15T10:30:00.000Z',
      type: 'FOLLOW_UP',
      physicianId: 'physician-1',
      physicianName: 'Dr. García',
      chiefComplaint: 'Persistent headache',
      currentIllness: 'Chronic migraine',
      physicalExam: { bp: '120/80' },
      assessment: 'Migraine without aura',
      diagnosisCodes: [
        { system: 'ICD10', code: 'G43.909', description: 'Migraine', type: 'primary' },
      ],
      plan: 'Continue topiramate',
      procedureCodes: null,
      followUpDate: '2024-02-15T10:30:00.000Z',
      followUpNotes: 'Review in 30 days',
      createdBy: 'user-1',
      updatedBy: null,
      createdAt: '2024-01-15T10:30:00.000Z',
      updatedAt: '2024-01-15T10:30:00.000Z',
    };

    it('should validate a complete consultation response', () => {
      const result = ConsultationResponseSchema.parse(validResponse);
      expect(result.id).toBe(validResponse.id);
      expect(result.type).toBe('FOLLOW_UP');
      expect(result.diagnosisCodes).toHaveLength(1);
    });

    it('should accept response without optional physician name', () => {
      const { physicianName, ...withoutName } = validResponse;
      const result = ConsultationResponseSchema.parse(withoutName);
      expect(result.physicianName).toBeUndefined();
    });

    it('should accept response with nullable fields set to null', () => {
      const data = {
        ...validResponse,
        currentIllness: null,
        physicalExam: null,
        assessment: null,
        diagnosisCodes: null,
        plan: null,
        procedureCodes: null,
        followUpDate: null,
        followUpNotes: null,
        updatedBy: null,
      };
      const result = ConsultationResponseSchema.parse(data);
      expect(result.currentIllness).toBeNull();
      expect(result.physicalExam).toBeNull();
      expect(result.assessment).toBeNull();
    });

    it('should reject response missing required id', () => {
      const { id, ...withoutId } = validResponse;
      expect(() => ConsultationResponseSchema.parse(withoutId)).toThrow();
    });

    it('should reject response with invalid UUID id', () => {
      expect(() => ConsultationResponseSchema.parse({ ...validResponse, id: 'not-uuid' })).toThrow();
    });
  });

  // ─────────────────────────────────────────────
  // ListConsultationsQuerySchema
  // ─────────────────────────────────────────────

  describe('ListConsultationsQuerySchema', () => {
    it('should accept empty query with defaults', () => {
      const result = ListConsultationsQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.sortBy).toBe('date');
      expect(result.sortOrder).toBe('desc');
    });

    it('should accept custom pagination', () => {
      const result = ListConsultationsQuerySchema.parse({ page: 2, pageSize: 50 });
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(50);
    });

    it('should reject pageSize over 100', () => {
      expect(() => ListConsultationsQuerySchema.parse({ pageSize: 101 })).toThrow();
    });

    it('should reject page less than 1', () => {
      expect(() => ListConsultationsQuerySchema.parse({ page: 0 })).toThrow();
    });

    it('should accept date range filters', () => {
      const result = ListConsultationsQuerySchema.parse({
        from: '2024-01-01T00:00:00.000Z',
        to: '2024-12-31T23:59:59.000Z',
      });
      expect(result.from).toBe('2024-01-01T00:00:00.000Z');
      expect(result.to).toBe('2024-12-31T23:59:59.000Z');
    });

    it('should accept type filter', () => {
      const result = ListConsultationsQuerySchema.parse({ type: 'URGENCY' });
      expect(result.type).toBe('URGENCY');
    });

    it('should reject invalid type filter', () => {
      expect(() => ListConsultationsQuerySchema.parse({ type: 'ROUTINE' })).toThrow();
    });

    it('should accept all valid sortBy values', () => {
      for (const sortBy of ['date', 'createdAt'] as const) {
        const result = ListConsultationsQuerySchema.parse({ sortBy });
        expect(result.sortBy).toBe(sortBy);
      }
    });

    it('should accept all valid sortOrder values', () => {
      for (const sortOrder of ['asc', 'desc'] as const) {
        const result = ListConsultationsQuerySchema.parse({ sortOrder });
        expect(result.sortOrder).toBe(sortOrder);
      }
    });

    it('should reject invalid sortBy', () => {
      expect(() => ListConsultationsQuerySchema.parse({ sortBy: 'type' })).toThrow();
    });

    it('should reject invalid sortOrder', () => {
      expect(() => ListConsultationsQuerySchema.parse({ sortOrder: 'random' })).toThrow();
    });

    it('should coerce string page to number', () => {
      const result = ListConsultationsQuerySchema.parse({ page: '3', pageSize: '10' });
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
    });
  });

  // ─────────────────────────────────────────────
  // ConsultationListItemSchema
  // ─────────────────────────────────────────────

  describe('ConsultationListItemSchema', () => {
    const validItem = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      patientId: '660e8400-e29b-41d4-a716-446655440001',
      date: '2024-01-15T10:30:00.000Z',
      type: 'FIRST_VISIT',
      physicianId: 'physician-1',
      physicianName: 'Dr. García',
      chiefComplaint: 'Persistent headache',
      createdAt: '2024-01-15T10:30:00.000Z',
    };

    it('should accept a valid consultation list item', () => {
      const result = ConsultationListItemSchema.parse(validItem);
      expect(result.id).toBe(validItem.id);
      expect(result.type).toBe('FIRST_VISIT');
      expect(result.chiefComplaint).toBe('Persistent headache');
    });

    it('should accept item without optional physicianName', () => {
      const { physicianName, ...withoutName } = validItem;
      const result = ConsultationListItemSchema.parse(withoutName);
      expect(result.physicianName).toBeUndefined();
    });

    it('should reject item missing required id', () => {
      const { id, ...withoutId } = validItem;
      expect(() => ConsultationListItemSchema.parse(withoutId)).toThrow();
    });

    it('should reject item with invalid UUID id', () => {
      expect(() => ConsultationListItemSchema.parse({ ...validItem, id: 'not-uuid' })).toThrow();
    });

    it('should reject item missing required chiefComplaint', () => {
      const { chiefComplaint, ...without } = validItem;
      expect(() => ConsultationListItemSchema.parse(without)).toThrow();
    });
  });

  // ─────────────────────────────────────────────
  // SearchConsultationLogsSchema
  // ─────────────────────────────────────────────

  describe('SearchConsultationLogsSchema', () => {
    it('should accept valid search with required query', () => {
      const result = SearchConsultationLogsSchema.parse({ query: 'headache' });
      expect(result.query).toBe('headache');
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should accept full search with all fields', () => {
      const result = SearchConsultationLogsSchema.parse({
        query: 'migraine',
        field: 'chiefComplaint',
        fromDate: '2024-01-01T00:00:00.000Z',
        toDate: '2024-12-31T23:59:59.000Z',
        page: 2,
        pageSize: 50,
      });
      expect(result.query).toBe('migraine');
      expect(result.field).toBe('chiefComplaint');
      expect(result.fromDate).toBe('2024-01-01T00:00:00.000Z');
      expect(result.toDate).toBe('2024-12-31T23:59:59.000Z');
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(50);
    });

    it('should default page and pageSize', () => {
      const result = SearchConsultationLogsSchema.parse({ query: 'test' });
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should reject empty query', () => {
      expect(() => SearchConsultationLogsSchema.parse({ query: '' })).toThrow();
    });

    it('should reject missing query', () => {
      expect(() => SearchConsultationLogsSchema.parse({})).toThrow();
    });

    it('should reject pageSize over 100', () => {
      expect(() => SearchConsultationLogsSchema.parse({ query: 'test', pageSize: 101 })).toThrow();
    });

    it('should reject page less than 1', () => {
      expect(() => SearchConsultationLogsSchema.parse({ query: 'test', page: 0 })).toThrow();
    });

    it('should coerce string page to number', () => {
      const result = SearchConsultationLogsSchema.parse({ query: 'test', page: '3', pageSize: '10' });
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
    });

    it('should accept optional field filter', () => {
      const result = SearchConsultationLogsSchema.parse({ query: 'pain', field: 'assessment' });
      expect(result.field).toBe('assessment');
    });

    it('should reject invalid datetime for fromDate', () => {
      expect(() => SearchConsultationLogsSchema.parse({ query: 'test', fromDate: 'not-a-date' })).toThrow();
    });
  });
});