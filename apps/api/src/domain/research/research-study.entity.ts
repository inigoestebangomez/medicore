// apps/api/src/domain/research/research-study.entity.ts
// Domain entity: ResearchStudy — a live cohort wrapping an immutable
// ResearchQuery via FK (composition, M8). BR-RES-008: auto-recalculate on
// import completion. BR-RES-009: only the owner can freeze (irreversible).

import { StudyStatusVO, type StudyStatusLiteral } from './value-objects/study-status.vo';
import { InvalidStudyTransitionError } from './value-objects/study-status.vo';

export interface ResearchStudyProps {
  id: string;
  organizationId: string;
  createdBy: string;
  queryId: string;
  name: string;
  description?: string | null;
  status: StudyStatusLiteral;
  cachedPatientIds?: string[];
  cachedAt?: Date | null;
  patientCount?: number;
  analyses?: unknown[];
  publicationRef?: string | null;
  frozenAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export class ResearchStudy {
  readonly id: string;
  readonly organizationId: string;
  readonly createdBy: string;
  readonly queryId: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: StudyStatusVO;
  readonly cachedPatientIds: string[];
  readonly cachedAt: Date | null;
  readonly patientCount: number;
  readonly analyses: unknown[];
  readonly publicationRef: string | null;
  readonly frozenAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  constructor(props: ResearchStudyProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.createdBy = props.createdBy;
    this.queryId = props.queryId;
    this.name = props.name;
    this.description = props.description ?? null;
    this.status = StudyStatusVO.create(props.status);
    this.cachedPatientIds = props.cachedPatientIds ?? [];
    this.cachedAt = props.cachedAt ?? null;
    this.patientCount = props.patientCount ?? 0;
    this.analyses = props.analyses ?? [];
    this.publicationRef = props.publicationRef ?? null;
    this.frozenAt = props.frozenAt ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    this.deletedAt = props.deletedAt ?? null;
  }

  // Factory ──────────────────────────────────────
  static create(props: {
    id: string;
    organizationId: string;
    createdBy: string;
    queryId: string;
    name: string;
    description?: string;
    publicationRef?: string;
  }): ResearchStudy {
    return new ResearchStudy({
      id: props.id,
      organizationId: props.organizationId,
      createdBy: props.createdBy,
      queryId: props.queryId,
      name: props.name,
      description: props.description ?? null,
      status: 'DRAFT',
      cachedPatientIds: [],
      cachedAt: null,
      patientCount: 0,
      analyses: [],
      publicationRef: props.publicationRef ?? null,
    });
  }

  // Lifecycle ──────────────────────────────────────
  activate(): ResearchStudy {
    StudyStatusVO.assertTransition(this.status.value, 'ACTIVE');
    return this.clone({ status: 'ACTIVE', updatedAt: new Date() });
  }

  archive(): ResearchStudy {
    StudyStatusVO.assertTransition(this.status.value, 'ARCHIVED');
    return this.clone({ status: 'ARCHIVED', updatedAt: new Date() });
  }

  /** ARCHIVED→ACTIVE — resume a paused live cohort (idempotent on ACTIVE). */
  reactivate(): ResearchStudy {
    StudyStatusVO.assertTransition(this.status.value, 'ACTIVE');
    return this.clone({ status: 'ACTIVE', updatedAt: new Date() });
  }

  /** BR-RES-009: only the owner can freeze; FROZEN is irreversible. */
  freeze(userId: string): ResearchStudy {
    if (!this.isOwnedBy(userId)) {
      throw new Error('freeze_not_allowed: only the study owner can freeze');
    }
    if (!this.status.canBeFrozen) {
      throw new InvalidStudyTransitionError(this.status.value, 'FROZEN');
    }
    return this.clone({ status: 'FROZEN', frozenAt: new Date(), updatedAt: new Date() });
  }

  /** Reactivate an ACTIVE study (no-op) — re-runs are idempotent. */
  recalculate(patientIds: string[]): ResearchStudy {
    if (this.status.isFrozen) {
      throw new Error('recalculate_not_allowed: study is frozen (immutable cohort)');
    }
    return this.clone({
      cachedPatientIds: patientIds,
      cachedAt: new Date(),
      patientCount: patientIds.length,
      updatedAt: new Date(),
    });
  }

  rename(name: string, description?: string | null): ResearchStudy {
    return this.clone({
      name,
      description: description !== undefined ? description : this.description,
      updatedAt: new Date(),
    });
  }

  updateAnalyses(analyses: unknown[]): ResearchStudy {
    return this.clone({ analyses, updatedAt: new Date() });
  }

  setPublicationRef(ref: string | null): ResearchStudy {
    return this.clone({ publicationRef: ref, updatedAt: new Date() });
  }

  // Predicates ────────────────────────────────────
  isOwnedBy(userId: string): boolean {
    return this.createdBy === userId;
  }

  /** Stale cache = ACTIVE studies whose cachedAt is null or older than `hours`. */
  isStale(hours = 6): boolean {
    if (!this.status.isActive) return false;
    if (this.cachedAt === null) return true;
    return Date.now() - this.cachedAt.getTime() > hours * 3600 * 1000;
  }

  // Internal ──────────────────────────────────────
  private clone(overrides: Partial<ResearchStudyProps>): ResearchStudy {
    return new ResearchStudy({
      id: this.id,
      organizationId: this.organizationId,
      createdBy: this.createdBy,
      queryId: this.queryId,
      name: this.name,
      description: this.description,
      status: this.status.value,
      cachedPatientIds: this.cachedPatientIds,
      cachedAt: this.cachedAt,
      patientCount: this.patientCount,
      analyses: this.analyses,
      publicationRef: this.publicationRef,
      frozenAt: this.frozenAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
      ...overrides,
    });
  }
}