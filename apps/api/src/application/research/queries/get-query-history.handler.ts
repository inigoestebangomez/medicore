// apps/api/src/application/research/queries/get-query-history.handler.ts
// Query handler: GetQueryHistory.
// Lists the caller's saved research queries, paginated, with last-run info.
// BR-RES-001: only queries the user created or that are explicitly shared with
// them are returned (the repository enforces this filter).

import { Injectable, Inject } from '@nestjs/common';
import type { IResearchQueryRepository } from '@/domain/research/research-query.repository.interface';
import type { ResearchQueryResponse } from '@medicore/contracts';

export interface GetQueryHistoryCommand {
  organizationId: string;
  userId: string;
  page: number;
  pageSize: number;
}

export interface QueryHistoryItem {
  id: string;
  name: string;
  description: string | null;
  dataSource: string;
  lastRunAt: string | null;
  lastRunCount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetQueryHistoryResult {
  items: QueryHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class GetQueryHistoryHandler {
  constructor(
    @Inject('IResearchQueryRepository')
    private readonly queryRepo: IResearchQueryRepository,
  ) {}

  async execute(cmd: GetQueryHistoryCommand): Promise<GetQueryHistoryResult> {
    const { items, total } = await this.queryRepo.findByOrg({
      organizationId: cmd.organizationId,
      userId: cmd.userId,
      page: cmd.page,
      pageSize: cmd.pageSize,
    });

    return {
      items: items.map((q): QueryHistoryItem => ({
        id: q.id,
        name: q.name,
        description: q.description,
        dataSource: q.dataSource,
        lastRunAt: q.lastRunAt ? q.lastRunAt.toISOString() : null,
        lastRunCount: q.lastRunCount,
        createdAt: q.createdAt.toISOString(),
        updatedAt: q.updatedAt.toISOString(),
      })),
      total,
      page: cmd.page,
      pageSize: cmd.pageSize,
    };
  }
}

// Re-export the contracts type so the API mapper can reference it without a
// second import path.
export type { ResearchQueryResponse };
