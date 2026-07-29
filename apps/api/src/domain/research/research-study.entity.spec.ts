// apps/api/src/domain/research/research-study.entity.spec.ts
import { describe, it, expect } from '@jest/globals';
import { ResearchStudy } from './research-study.entity';
import { StudyStatusVO, InvalidStudyTransitionError } from './value-objects/study-status.vo';

const base = {
  id: 's1',
  organizationId: 'org1',
  createdBy: 'u1',
  queryId: 'q1',
  name: 'Estudio',
};

describe('ResearchStudy entity', () => {
  it('creates as DRAFT and is owned by creator', () => {
    const s = ResearchStudy.create(base);
    expect(s.status.value).toBe('DRAFT');
    expect(s.isOwnedBy('u1')).toBe(true);
    expect(s.isOwnedBy('u2')).toBe(false);
    expect(s.isStale()).toBe(false); // DRAFT not active => not stale
  });

  it('activates DRAFT→ACTIVE', () => {
    const s = ResearchStudy.create(base).activate();
    expect(s.status.value).toBe('ACTIVE');
  });

  it('idempotent activate: DRAFT→ACTIVE→ACTIVE stays ACTIVE (no throw)', () => {
    const active = ResearchStudy.create(base).activate();
    const stillActive = active.activate();
    expect(stillActive.status.value).toBe('ACTIVE');
  });

  it('archives ACTIVE→ARCHIVED (paused, can be reactivated)', () => {
    const s = ResearchStudy.create(base).activate().archive();
    expect(s.status.value).toBe('ARCHIVED');
    expect(s.status.isTerminal).toBe(false); // ARCHIVED can be reactivated
  });

  it('freezes ACTIVE→FROZEN only by owner (BR-RES-009)', () => {
    const active = ResearchStudy.create(base).activate();
    expect(() => active.freeze('u2')).toThrow(/freeze_not_allowed/);
    const frozen = active.freeze('u1');
    expect(frozen.status.value).toBe('FROZEN');
    expect(frozen.frozenAt).not.toBeNull();
  });

  it('FROZEN is irreversible — cannot activate/archive/freeze again', () => {
    const frozen = ResearchStudy.create(base).activate().freeze('u1');
    expect(() => frozen.activate()).toThrow(InvalidStudyTransitionError);
    expect(() => frozen.archive()).toThrow(InvalidStudyTransitionError);
  });

  it('refuses to freeze a DRAFT study directly', () => {
    const draft = ResearchStudy.create(base);
    expect(() => draft.freeze('u1')).toThrow();
  });

  it('recalculate updates cached patient ids/count/timestamp', () => {
    const s = ResearchStudy.create(base).activate();
    const r = s.recalculate(['p1', 'p2', 'p3']);
    expect(r.cachedPatientIds).toEqual(['p1', 'p2', 'p3']);
    expect(r.patientCount).toBe(3);
    expect(r.cachedAt).not.toBeNull();
  });

  it('recalculate is blocked when frozen (immutable cohort)', () => {
    const frozen = ResearchStudy.create(base).activate().freeze('u1');
    expect(() => frozen.recalculate(['x'])).toThrow(/frozen/i);
  });

  it('isStale true when ACTIVE with null cache', () => {
    const s = ResearchStudy.create(base).activate();
    expect(s.isStale()).toBe(true);
  });

  it('isStale true when ACTIVE cache older than threshold', () => {
    const old = new Date(Date.now() - 10 * 3600 * 1000);
    const s = new ResearchStudy({ ...base, status: 'ACTIVE', cachedAt: old });
    expect(s.isStale(6)).toBe(true);
  });
});

describe('StudyStatusVO', () => {
  it('permits DRAFT→ACTIVE, ACTIVE→ARCHIVED, ACTIVE→FROZEN', () => {
    expect(StudyStatusVO.canTransition('DRAFT', 'ACTIVE')).toBe(true);
    expect(StudyStatusVO.canTransition('ACTIVE', 'ARCHIVED')).toBe(true);
    expect(StudyStatusVO.canTransition('ACTIVE', 'FROZEN')).toBe(true);
  });

  it('forbids outbound transitions from FROZEN; allows ARCHIVED→ACTIVE', () => {
    expect(StudyStatusVO.canTransition('FROZEN', 'ACTIVE')).toBe(false);
    expect(StudyStatusVO.canTransition('ARCHIVED', 'ACTIVE')).toBe(true); // reactivate
    expect(StudyStatusVO.canTransition('DRAFT', 'FROZEN')).toBe(false);
  });

  it('is same-state idempotent', () => {
    expect(StudyStatusVO.canTransition('ACTIVE', 'ACTIVE')).toBe(true);
  });

  it('assertTransition throws on invalid', () => {
    expect(() => StudyStatusVO.assertTransition('FROZEN', 'ACTIVE')).toThrow(InvalidStudyTransitionError);
  });
});