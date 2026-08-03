// apps/api/src/domain/research/ports/statistical-analysis.repository.interface.ts
// Port: IStatisticalAnalysisRepository — persistence boundary for
// StatisticalAnalysis traceability (REQ-FB-012). Multi-tenant.

import type { StatisticalAnalysis } from '../statistical-analysis.entity';

export interface IStatisticalAnalysisRepository {
  create(analysis: StatisticalAnalysis): Promise<StatisticalAnalysis>;
  findByStudy(studyId: string, organizationId: string): Promise<StatisticalAnalysis[]>;
  findById(id: string, organizationId: string): Promise<StatisticalAnalysis | null>;
}