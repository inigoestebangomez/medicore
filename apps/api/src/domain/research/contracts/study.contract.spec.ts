// apps/api/src/domain/research/contracts/study.contract.spec.ts
import { describe, it, expect } from '@jest/globals';
import {
  StudyStatusSchema,
  CreateStudyInputSchema,
  UpdateStudyInputSchema,
  ListStudiesQuerySchema,
  SuggestionTypeSchema,
} from './study.contract';

describe('study.contract (Zod)', () => {
  it('accepts valid CreateStudyInput', () => {
    const r = CreateStudyInputSchema.safeParse({
      queryId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Septoplastia cohort',
      description: 'Estudio retrospectivo',
    });
    expect(r.success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(CreateStudyInputSchema.safeParse({ queryId: 'q', name: '' }).success).toBe(false);
  });

  // V4 (REQ-FB-008): queryId is now optional — a FORM study is created
  // without an originating ResearchQuery. QUERY/HYBRID still require it,
  // but that is enforced in CreateStudyHandler (domain rule), not the contract.
  it('accepts queryId missing for FORM study create', () => {
    expect(
      CreateStudyInputSchema.safeParse({ studyType: 'FORM', name: 'x' }).success,
    ).toBe(true);
    // Defaults to QUERY studyType when omitted
    expect(CreateStudyInputSchema.parse({ name: 'x' }).studyType).toBe(
      'QUERY',
    );
  });

  it('accepts partial UpdateStudyInput', () => {
    expect(UpdateStudyInputSchema.safeParse({ name: 'new' }).success).toBe(true);
  });

  it('validates StudyStatus enum', () => {
    expect(StudyStatusSchema.safeParse('ACTIVE').success).toBe(true);
    expect(StudyStatusSchema.safeParse('INVALID').success).toBe(false);
  });

  it('coerces page/pageSize in ListStudiesQuery', () => {
    const r = ListStudiesQuerySchema.parse({ page: '2', pageSize: '5' });
    expect(r.page).toBe(2);
    expect(r.pageSize).toBe(5);
  });

  it('defaults pagination when omitted', () => {
    expect(ListStudiesQuerySchema.parse({}).page).toBe(1);
  });

  it('validates SuggestionType enum', () => {
    expect(SuggestionTypeSchema.safeParse('pre_post_available').success).toBe(true);
    expect(SuggestionTypeSchema.safeParse('nope').success).toBe(false);
  });
});