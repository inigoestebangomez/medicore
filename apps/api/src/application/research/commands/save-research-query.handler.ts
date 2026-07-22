// apps/api/src/application/research/commands/save-research-query.handler.ts
// Command handler: SaveResearchQuery.
// Creates a new saved query (BR-RES-001: private by default) or updates an
// existing one if the ID is already present.

import { randomUUID } from 'node:crypto';
import { Injectable, Inject } from '@nestjs/common';
import type {
  Filter,
  FilterLogic,
  DataSource,
  VisualizationType,
} from '@medicore/contracts';
import type { IResearchQueryRepository } from '@/domain/research/research-query.repository.interface';
import { ResearchQuery } from '@/domain/research/research-query.entity';
import { ResearchQueryNotFoundError } from '@/domain/research/errors/research-query-not-found.error';

export interface SaveQueryCommand {
  queryId?: string; // if provided, update existing; if absent, create new
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
}

export interface SaveQueryResult {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class SaveQueryHandler {
  constructor(
    @Inject('IResearchQueryRepository') private readonly queryRepo: IResearchQueryRepository,
  ) {}

  async execute(cmd: SaveQueryCommand): Promise<SaveQueryResult> {
    let query: ResearchQuery;

    if (cmd.queryId) {
      // Update existing
      const existing = await this.queryRepo.findById(cmd.queryId, cmd.organizationId);
      if (!existing) throw new ResearchQueryNotFoundError(cmd.queryId);

      const updated = existing.updateConfig({
        name: cmd.name,
        description: cmd.description,
        dataSource: cmd.dataSource,
        importBatchIds: cmd.importBatchIds,
        displayFields: cmd.displayFields,
        visualizations: cmd.visualizations,
      });
      query = updated.updateFilters(cmd.filters, cmd.filterLogic);
    } else {
      // Create new — BR-RES-001: private by default
      query = ResearchQuery.createPrivate({
        id: randomUUID(),
        organizationId: cmd.organizationId,
        createdBy: cmd.createdBy,
        name: cmd.name,
        description: cmd.description ?? undefined,
        dataSource: cmd.dataSource,
        importBatchIds: cmd.importBatchIds,
        filters: cmd.filters,
        filterLogic: cmd.filterLogic,
        displayFields: cmd.displayFields,
        visualizations: cmd.visualizations,
      });
    }

    const saved = await this.queryRepo.save(query);

    return {
      id: saved.id,
      name: saved.name,
      createdAt: saved.createdAt.toISOString(),
      updatedAt: saved.updatedAt.toISOString(),
    };
  }
}