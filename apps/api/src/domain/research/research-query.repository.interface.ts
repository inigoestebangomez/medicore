// apps/api/src/domain/research/research-query.repository.interface.ts
import type { ResearchQuery } from './research-query.entity';
import type {
  Filter,
  FilterLogic,
  DataSource,
  VisualizationType,
} from '@medicore/contracts';

export interface SaveResearchQueryInput {
  id: string;
  organizationId: string;
  createdBy: string;
  name: string;
  description?: string | null;
  dataSource: DataSource;
  importBatchIds?: string[];
  filters: Filter[];
  filterLogic: FilterLogic;
  displayFields: string[];
  visualizations: VisualizationType[];
  sharedWith?: string[];
}

export interface IResearchQueryRepository {
  save(query: ResearchQuery): Promise<ResearchQuery>;
  findById(
    id: string,
    organizationId: string,
  ): Promise<ResearchQuery | null>;
  findByOrg(params: {
    organizationId: string;
    userId: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: ResearchQuery[]; total: number }>;
  update(query: ResearchQuery): Promise<ResearchQuery>;
  updateRunStats(
    id: string,
    organizationId: string,
    count: number,
  ): Promise<ResearchQuery>;
  shareWith(id: string, organizationId: string, userId: string): Promise<ResearchQuery>;
  unshareWith(id: string, organizationId: string, userId: string): Promise<ResearchQuery>;
  softDelete(id: string, organizationId: string): Promise<ResearchQuery>;
}