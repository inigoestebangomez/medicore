// apps/api/src/api/research/research.controller.ts
// REST endpoints for the Clinical Research Engine (spec §7-11). All
// tenant-scoped via the authenticated user's organizationId. Endpoints map
// to use case handlers:
//   POST   /v1/research/queries                      SaveQueryHandler
//   GET    /v1/research/queries                      GetQueryHistoryHandler (BR-RES-001)
//   GET    /v1/research/queries/:id                  single query detail
//   POST   /v1/research/queries/:id/execute          ExecuteResearchQueryHandler
//   DELETE /v1/research/queries/:id                  soft delete
//   POST   /v1/research/collections                  CreateCollectionHandler
//   GET    /v1/research/collections                  list collections
//   GET    /v1/research/collections/:id             single collection detail
//   POST   /v1/research/collections/:id/members     AddToCollectionHandler (BR-RES-003)
//   DELETE /v1/research/collections/:id/members/:patientId  remove member (BR-RES-003)
//   POST   /v1/research/collections/:id/lock        LockCollectionHandler (BR-RES-003)
//   POST   /v1/research/export                       ExportResultsHandler (BR-RES-002)
//
// RBAC: research reads/execute reuse READ_PATIENT (reading patient-derived
// cohorts); collection mutations reuse READ_PATIENT (cohort metadata, not
// patient records); export requires EXPORT_PATIENT (anonymized clinical
// export). This reuses the existing permission matrix without adding new
// actions.

import {
  Controller, Get, Post, Delete, Param, Body, Query, Res,
  UseGuards, Inject, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import type { JwtPayload, Filter, FilterLogic, DataSource, VisualizationType, ExportFormat } from '@medicore/contracts';
import { Action } from '@/domain/shared/rbac-permissions';
import type { IResearchQueryRepository } from '@/domain/research/research-query.repository.interface';
import type { IPatientCollectionRepository } from '@/domain/research/patient-collection.repository.interface';
import { SaveQueryHandler } from '@/application/research/commands/save-research-query.handler';
import { CreateCollectionHandler } from '@/application/research/commands/create-collection.handler';
import { AddToCollectionHandler } from '@/application/research/commands/add-to-collection.handler';
import { LockCollectionHandler } from '@/application/research/commands/lock-collection.handler';
import { ExportResultsHandler } from '@/application/research/commands/export-collection.handler';
import { GetQueryHistoryHandler } from '@/application/research/queries/get-query-history.handler';
import { ExecuteResearchQueryHandler } from '@/application/research/queries/execute-research-query.handler';
import { ResearchQueryNotFoundError } from '@/domain/research/errors/research-query-not-found.error';
import { CollectionNotFoundError } from '@/domain/research/errors/collection-not-found.error';
import { CollectionLockedError } from '@/domain/research/errors/collection-locked.error';

@Controller('research')
@UseGuards(AuthGuard, RBACGuard)
export class ResearchController {
  private readonly saveHandler: SaveQueryHandler;
  private readonly historyHandler: GetQueryHistoryHandler;
  private readonly executeHandler: ExecuteResearchQueryHandler;
  private readonly createCollectionHandler: CreateCollectionHandler;
  private readonly addMemberHandler: AddToCollectionHandler;
  private readonly lockHandler: LockCollectionHandler;
  private readonly exportHandler: ExportResultsHandler;

  constructor(
    @Inject('IResearchQueryRepository') private readonly queryRepo: IResearchQueryRepository,
    @Inject('IPatientCollectionRepository') private readonly collectionRepo: IPatientCollectionRepository,
    save: SaveQueryHandler,
    history: GetQueryHistoryHandler,
    execute: ExecuteResearchQueryHandler,
    createCollection: CreateCollectionHandler,
    addMember: AddToCollectionHandler,
    lock: LockCollectionHandler,
    exportHandler: ExportResultsHandler,
  ) {
    this.saveHandler = save;
    this.historyHandler = history;
    this.executeHandler = execute;
    this.createCollectionHandler = createCollection;
    this.addMemberHandler = addMember;
    this.lockHandler = lock;
    this.exportHandler = exportHandler;
  }

  // ─────────────────────────────────────────────
  // Saved queries — BR-RES-001 (private by default)
  // ─────────────────────────────────────────────

  /** Create a new query or update an existing one (body.id present → update). */
  @Post('queries')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async saveQuery(
    @Body() body: {
      id?: string;
      name: string;
      description?: string;
      dataSource: DataSource;
      importBatchIds?: string[];
      filters: Filter[];
      filterLogic: FilterLogic;
      displayFields: string[];
      visualizations: VisualizationType[];
    },
    @CurrentUser() user: JwtPayload,
  ) {
    if (!body?.name) throw new BadRequestException('name is required');
    try {
      const result = await this.saveHandler.execute({
        queryId: body.id,
        organizationId: user.organizationId,
        createdBy: user.sub,
        name: body.name,
        description: body.description ?? null,
        dataSource: body.dataSource,
        importBatchIds: body.importBatchIds,
        filters: body.filters,
        filterLogic: body.filterLogic,
        displayFields: body.displayFields,
        visualizations: body.visualizations,
      });
      return { data: result };
    } catch (err) {
      this.mapDomainError(err);
    }
  }

  /** Paginated history — only caller's own + shared queries (BR-RES-001). */
  @Get('queries')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async listQueries(
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.historyHandler.execute({
      organizationId: user.organizationId,
      userId: user.sub,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
    return { data: result };
  }

  /** Single query detail. */
  @Get('queries/:id')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async getQuery(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const query = await this.queryRepo.findById(id, user.organizationId);
    if (!query) throw new NotFoundException(`Research query not found: ${id}`);
    // BR-RES-001: enforce visibility server-side as a defense-in-depth.
    if (!query.isVisibleTo(user.sub)) throw new NotFoundException(`Research query not found: ${id}`);
    return { data: query };
  }

  /**
   * Execute a saved query. Optional body overrides filters/logic/displayFields
   * for an ad-hoc run without persisting. BR-RES-004 (N<5 suppression) is
   * applied downstream by StatsCalculatorService.
   */
  @Post('queries/:id/execute')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async executeQuery(
    @Param('id') id: string,
    @Body() body: { filters?: Filter[]; filterLogic?: FilterLogic; displayFields?: string[] } | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.executeHandler.execute({
        queryId: id,
        organizationId: user.organizationId,
        filters: body?.filters,
        filterLogic: body?.filterLogic,
        displayFields: body?.displayFields,
      });
      return { data: result };
    } catch (err) {
      this.mapDomainError(err);
    }
  }

  /** Soft delete a saved query. */
  @Delete('queries/:id')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async deleteQuery(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const existing = await this.queryRepo.findById(id, user.organizationId);
    if (!existing) throw new NotFoundException(`Research query not found: ${id}`);
    await this.queryRepo.softDelete(id, user.organizationId);
    return { data: { id, deleted: true } };
  }

  // ─────────────────────────────────────────────
  // Patient collections — BR-RES-003 (locked = immutable)
  // ─────────────────────────────────────────────

  /** Create a collection from a query snapshot or explicit IDs. */
  @Post('collections')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async createCollection(
    @Body() body: {
      name: string;
      description?: string;
      queryId?: string;
      patientIds?: string[];
    },
    @CurrentUser() user: JwtPayload,
  ) {
    if (!body?.name) throw new BadRequestException('name is required');
    try {
      const result = await this.createCollectionHandler.execute({
        organizationId: user.organizationId,
        createdBy: user.sub,
        name: body.name,
        description: body.description ?? null,
        queryId: body.queryId,
        patientIds: body.patientIds,
      });
      return { data: result };
    } catch (err) {
      this.mapDomainError(err);
    }
  }

  /** List collections for the org. */
  @Get('collections')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async listCollections(
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.collectionRepo.findByOrg({
      organizationId: user.organizationId,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
    return { data: result };
  }

  /** Single collection detail. */
  @Get('collections/:id')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async getCollection(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const collection = await this.collectionRepo.findById(id, user.organizationId);
    if (!collection) throw new NotFoundException(`Collection not found: ${id}`);
    return { data: collection };
  }

  /** Add members — locked collection → 403 (BR-RES-003). */
  @Post('collections/:id/members')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async addMembers(
    @Param('id') id: string,
    @Body() body: { patientIds: string[]; notes?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    if (!body?.patientIds?.length) throw new BadRequestException('patientIds is required');
    try {
      const result = await this.addMemberHandler.execute({
        collectionId: id,
        organizationId: user.organizationId,
        addedBy: user.sub,
        patientIds: body.patientIds,
        notes: body.notes,
      });
      return { data: result };
    } catch (err) {
      this.mapDomainError(err);
    }
  }

  /** Remove a member — locked collection → 403 (BR-RES-003). */
  @Delete('collections/:id/members/:patientId')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async removeMember(
    @Param('id') id: string,
    @Param('patientId') patientId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const collection = await this.collectionRepo.removeMember(
        id,
        user.organizationId,
        patientId,
      );
      return { data: { collectionId: collection.id, patientCount: collection.patientCount } };
    } catch (err) {
      this.mapDomainError(err);
    }
  }

  /** Lock a collection for publication — immutable thereafter (BR-RES-003). */
  @Post('collections/:id/lock')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async lockCollection(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    try {
      const result = await this.lockHandler.execute({
        collectionId: id,
        organizationId: user.organizationId,
        lockedBy: user.sub,
      });
      return { data: result };
    } catch (err) {
      this.mapDomainError(err);
    }
  }

  // ─────────────────────────────────────────────
  // Export — BR-RES-002 (always anonymized)
  // ─────────────────────────────────────────────

  /**
   * Export a collection (collectionId) or a query result (queryId) in the
   * requested format. Always anonymized (BR-RES-002). Sets Content-Disposition
   * for downloadable formats.
   */
  @Post('export')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.EXPORT_PATIENT)
  async export(
    @Body() body: {
      collectionId?: string;
      queryId?: string;
      format: ExportFormat;
    },
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!body?.format) throw new BadRequestException('format is required');
    if (!body.collectionId && !body.queryId) {
      throw new BadRequestException('collectionId or queryId is required');
    }
    try {
      const result = await this.exportHandler.execute({
        collectionId: body.collectionId,
        queryId: body.queryId,
        organizationId: user.organizationId,
        format: body.format,
      });
      // For downloadable text/CSV/tabla1 formats, set Content-Disposition as a
      // hint. The body itself is returned inside the standard { data } envelope
      // so the global ResponseWrapperInterceptor stays consistent — the web
      // client builds the download Blob from data.content (BR-RES-002 verified
      // server-side: the payload never contains real identifiers).
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${result.filename}"`,
      );
      return { data: result };
    } catch (err) {
      this.mapDomainError(err);
    }
  }

  // ─────────────────────────────────────────────
  // Domain-error → HTTP mapping
  // ─────────────────────────────────────────────

  private mapDomainError(error: unknown): never {
    if (error instanceof ResearchQueryNotFoundError) throw new NotFoundException(error.message);
    if (error instanceof CollectionNotFoundError) throw new NotFoundException(error.message);
    if (error instanceof CollectionLockedError) throw new ForbiddenException(error.message); // BR-RES-003 → 403
    throw error;
  }
}