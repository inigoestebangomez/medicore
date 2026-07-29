// apps/api/src/domain/research/value-objects/study-status.vo.ts
// Value object: StudyStatus — validated state machine for ResearchStudy (M8).
// Permitted transitions (BR-RES-009): DRAFT→ACTIVE, ACTIVE→ARCHIVED,
// ACTIVE→FROZEN. ARCHIVED and FROZEN are terminal (no outgoing transitions).
// FROZEN is irreversible — a frozen cohort is immutable, like a published study.

export type StudyStatusLiteral = 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'FROZEN';

export class InvalidStudyTransitionError extends Error {
  constructor(
    public readonly from: StudyStatusLiteral,
    public readonly to: StudyStatusLiteral,
  ) {
    super(`Invalid study transition: ${from}→${to}`);
    this.name = 'InvalidStudyTransitionError';
  }
}

// ARCHIVED→ACTIVE is allowed so the `reactivate` endpoint can resume a
// paused live cohort. FROZEN has NO outgoing transitions — it is truly
// irreversible (published/immutable cohort, BR-RES-009).
const TRANSITIONS: Record<StudyStatusLiteral, StudyStatusLiteral[]> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['ARCHIVED', 'FROZEN'],
  ARCHIVED: ['ACTIVE'],
  FROZEN: [],
};

export class StudyStatusVO {
  private constructor(public readonly value: StudyStatusLiteral) {}

  static create(value: StudyStatusLiteral): StudyStatusVO {
    return new StudyStatusVO(value);
  }

  static canTransition(from: StudyStatusLiteral, to: StudyStatusLiteral): boolean {
    if (from === to) return true;
    return TRANSITIONS[from].includes(to);
  }

  static assertTransition(from: StudyStatusLiteral, to: StudyStatusLiteral): void {
    if (!this.canTransition(from, to)) {
      throw new InvalidStudyTransitionError(from, to);
    }
  }

  /** A frozen/archived study cannot be mutated further (terminal). */
  get isTerminal(): boolean {
    return this.value === 'FROZEN';
  }

  get isFrozen(): boolean {
    return this.value === 'FROZEN';
  }

  get isActive(): boolean {
    return this.value === 'ACTIVE';
  }

  get canBeFrozen(): boolean {
    return this.value === 'ACTIVE';
  }

  get canBeArchived(): boolean {
    return this.value === 'ACTIVE';
  }

  get canBeActivated(): boolean {
    return this.value === 'DRAFT';
  }

  equals(other: StudyStatusVO): boolean {
    return this.value === other.value;
  }
}