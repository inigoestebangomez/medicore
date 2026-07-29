// apps/api/src/domain/research/ports/research-study.repository.interface.ts
// Port: IResearchStudyRepository — persistence boundary for the
// ResearchStudy aggregate (Clean Architecture — handlers stay infra-agnostic).
// The Prisma adapter lives in infrastructure/repositories.

import type { ResearchStudy } from '../research-study.entity';
import type { StudyStatusLiteral } from '../value-objects/study-status.vo';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IResearchStudyRepository {
  create(study: ResearchStudy): Promise<ResearchStudy>;
  findById(id: string, organizationId: string): Promise<ResearchStudy | null>;
  findByOrganization(
    organizationId: string,
    opts?: { status?: StudyStatusLiteral; page?: number; pageSize?: number },
  ): Promise<Paginated<ResearchStudy>>;
  update(study: ResearchStudy): Promise<ResearchStudy>;
  /** Active studies whose cache is null or older than `hours`. */
  findActiveWithStaleCache(organizationId: string, hours: number): Promise<ResearchStudy[]>;
  softDelete(id: string, organizationId: string): Promise<void>;
}