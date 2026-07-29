// apps/api/src/api/research/execute.controller.ts
// Ad-hoc query execution + cursor paginated results (spec §8).
//   POST /research/queries/execute          — ad-hoc run, no saved query
//   GET  /research/queries/:id/results       — paginated results of a saved query
//
// Both reuse READ_PATIENT (cohort reads, no clinical write). Pagination is
// keyset (opaque cursor) so large cohorts (>1000) don't blow up the request.

import {
  Controller, Get, Post, Param, Body, Query,
  UseGuards, Inject, NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import type {
  JwtPayload, Filter, FilterLogic, DataSource, PaginatedResults,
} from '@medicore/contracts';
import { Action } from '@/domain/shared/rbac-permissions';
import type { IResearchQueryRepository } from '@/domain/research/research-query.repository.interface';
import { ResearchQueryNotFoundError } from '@/domain/research/errors/research-query-not-found.error';
import { ExecuteAdHocQueryHandler } from '@/application/research/queries/execute-adhoc-query.handler';

@Controller('research')
@UseGuards(AuthGuard, RBACGuard)
export class ExecuteController {
  constructor(
    @Inject('IResearchQueryRepository') private readonly queryRepo: IResearchQueryRepository,
    private readonly adHocHandler: ExecuteAdHocQueryHandler,
  ) {}

  /** Ad-hoc execution — returns results without creating a ResearchQuery. */
  @Post('queries/execute')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async executeAdHoc(
    @Body() body: {
      filters?: Filter[];
      filterLogic?: FilterLogic;
      dataSource?: DataSource;
      importBatchIds?: string[];
      displayFields?: string[];
      cursor?: string;
      limit?: number;
    },
    @CurrentUser() user: JwtPayload,
  ): Promise<{ data: PaginatedResults }> {
    const result = await this.adHocHandler.execute({
      organizationId: user.organizationId,
      filters: body?.filters ?? [],
      filterLogic: (body?.filterLogic ?? 'AND') as FilterLogic,
      dataSource: (body?.dataSource ?? 'all_patients') as DataSource,
      importBatchIds: body?.importBatchIds ?? [],
      displayFields: body?.displayFields ?? [],
      cursor: body?.cursor,
      limit: Math.min(Math.max(body?.limit ?? 50, 1), 200),
    });
    return { data: result };
  }

  /**
   * Paginated results of a SAVED query (cursor). Reuses the query's stored
   * filters and displayFields; caller supplies only the cursor + limit.
   */
  @Get('queries/:id/results')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async paginatedResults(
    @Param('id') id: string,
    @Query('cursor') cursor: string,
    @Query('limit') limit: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ data: PaginatedResults }> {
    const query = await this.queryRepo.findById(id, user.organizationId);
    if (!query) throw new ResearchQueryNotFoundError(id);
    if (!query.isVisibleTo(user.sub)) throw new NotFoundException(`Research query not found: ${id}`);

    const result = await this.adHocHandler.execute({
      organizationId: user.organizationId,
      filters: query.filters,
      filterLogic: query.filterLogic,
      dataSource: query.dataSource,
      importBatchIds: query.importBatchIds,
      displayFields: query.displayFields,
      cursor: cursor || undefined,
      limit: Math.min(Math.max(limit ? Number(limit) : 50, 1), 200),
    });
    return { data: result };
  }
}