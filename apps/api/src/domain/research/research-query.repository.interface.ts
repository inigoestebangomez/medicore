// apps/api/src/domain/research/research-query.repository.interface.ts
import type { ResearchQuery } from './research-query.entity';
import type {
  Filter,
  FilterLogic,
  DataSource,
  VisualizationType,
  Sharing,
  SharePermission,
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
  /** Research V2: structured sharing (users + permission) */
  sharing?: Sharing;
  /** Research V2: optional owning dashboard */
  dashboardId?: string | null;
}

export interface SharedQueryRow {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  permission: SharePermission;
  updatedAt: Date;
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
  // ── Research Engine V2 (sharing) ──
  /** Replace the structured sharing config (users + permission) — spec §7. */
  updateSharing(
    id: string,
    organizationId: string,
    sharing: Sharing,
  ): Promise<ResearchQuery>;
  /** List queries shared with a user (with permission), excluding their own. */
  findSharedWithMe(
    organizationId: string,
    userId: string,
  ): Promise<SharedQueryRow[]>;
}