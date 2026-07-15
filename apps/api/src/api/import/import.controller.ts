// apps/api/src/api/import/import.controller.ts
// REST endpoints for the import pipeline (spec §3). All tenant-scoped via the
// authenticated user's organizationId. Endpoints map to use case handlers:
//   POST   /v1/imports:upload         Stage 1  ParseFileHandler
//   POST   /v1/imports/:id/reanalyze  Stage 1b AnalyzeColumnsHandler
//   POST   /v1/imports/:id/confirm    Stages 2-4 ConfirmImportHandler
//   POST   /v1/imports/:id/finalize   Stage 5  enqueue BullMQ ImportProcessor
//   POST   /v1/imports/:id/revert     BR-IMP-005 RevertImportHandler
//   GET    /v1/imports                GetImportHistoryHandler
//   GET    /v1/imports/:id            single batch detail
//
// BR-IMP-001: no endpoint mutates patients directly; finalize only enqueues
// the background job, which is the single place patients are written.

import {
  Controller, Get, Post, Param, Body, Query, UseGuards, UseInterceptors,
  UploadedFile, Inject, NotFoundException, UnprocessableEntityException,
  ConflictException, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import type { JwtPayload, ColumnMapping } from '@medicore/contracts';
import { Action } from '@/domain/shared/rbac-permissions';
import type { IImportBatchRepository } from '@/domain/import/import-batch.repository.interface';
import { ParseFileHandler } from '@/application/import/handlers/parse-file.handler';
import { AnalyzeColumnsHandler } from '@/application/import/handlers/analyze-columns.handler';
import { ConfirmImportHandler } from '@/application/import/handlers/confirm-import.handler';
import { RevertImportHandler } from '@/application/import/handlers/revert-import.handler';
import { GetImportHistoryHandler } from '@/application/import/handlers/get-import-history.handler';
import { ImportBatchNotFoundError } from '@/domain/import/errors/import-batch-not-found.error';
import { InvalidImportTransitionError } from '@/domain/import/errors/invalid-import-transition.error';
import { FileEmptyError } from '@/domain/import/errors/file-empty.error';
import { IMPORT_QUEUE } from '@/infrastructure/queues/import-processor';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB per spec §2 (hospital Excels)

@Controller('imports')
@UseGuards(AuthGuard, RBACGuard)
export class ImportController {
  private readonly parseHandler: ParseFileHandler;
  private readonly reanalyzeHandler: AnalyzeColumnsHandler;
  private readonly confirmHandler: ConfirmImportHandler;
  private readonly revertHandler: RevertImportHandler;
  private readonly historyHandler: GetImportHistoryHandler;

  constructor(
    @Inject('IImportBatchRepository') private readonly batchRepo: IImportBatchRepository,
    parser: ParseFileHandler,
    analyzer: AnalyzeColumnsHandler,
    confirm: ConfirmImportHandler,
    revert: RevertImportHandler,
    history: GetImportHistoryHandler,
    @Inject(IMPORT_QUEUE) private readonly importQueue: { add: (name: string, data: unknown) => Promise<unknown> },
  ) {
    this.parseHandler = parser;
    this.reanalyzeHandler = analyzer;
    this.confirmHandler = confirm;
    this.revertHandler = revert;
    this.historyHandler = history;
  }

  /** Stage 1 — upload + parse + AI analysis. Returns the proposed mapping. */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.IMPORT_DATA)
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file || !file.buffer) throw new BadRequestException('file is required');
    try {
      const result = await this.parseHandler.execute({
        buffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
        organizationId: user.organizationId,
        createdBy: user.sub,
      });
      return { data: result };
    } catch (err) {
      this.mapDomainError(err);
    }
  }

  /** Stage 1b — re-run the analyzer on the cached sample. */
  @Post(':id/reanalyze')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.IMPORT_DATA)
  async reanalyze(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    try {
      const result = await this.reanalyzeHandler.execute({
        batchId: id,
        organizationId: user.organizationId,
      });
      return { data: result };
    } catch (err) {
      this.mapDomainError(err);
    }
  }

  /** Stages 2-4 — confirm mapping, clean, match; returns the match list. */
  @Post(':id/confirm')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.IMPORT_DATA)
  async confirm(
    @Param('id') id: string,
    @Body() body: {
      columnMapping: Record<string, string>;
      customFieldNames?: Record<string, string>;
      junkRowIndices?: number[];
    },
    @CurrentUser() user: JwtPayload,
  ) {
    if (!body?.columnMapping) throw new BadRequestException('columnMapping is required');
    try {
      const result = await this.confirmHandler.execute({
        batchId: id,
        organizationId: user.organizationId,
        columnMapping: body.columnMapping as unknown as ColumnMapping,
        customFieldNames: body.customFieldNames,
        junkRowIndices: body.junkRowIndices,
      });
      return { data: result };
    } catch (err) {
      this.mapDomainError(err);
    }
  }

  /**
   * Stage 5 — physician resolved all matches. Enqueue the background finalize
   * job. The job does the actual patient create/enrich (BR-IMP-001/003).
   */
  @Post(':id/finalize')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.IMPORT_DATA)
  async finalize(
    @Param('id') id: string,
    @Body() body: { matchResolutions?: Record<string, 'auto' | 'confirm' | 'new'> },
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      await this.importQueue.add('finalize', {
        batchId: id,
        organizationId: user.organizationId,
        userId: user.sub,
        matchResolutions: body.matchResolutions ?? {},
      });
      return {
        data: {
          batchId: id,
          status: 'PROCESSING',
          message: 'Importación encolada. Consulta el estado en GET /v1/imports/:id',
        },
      };
    } catch (err) {
      this.mapDomainError(err);
    }
  }

  /** BR-IMP-005 — revert a finalized import. */
  @Post(':id/revert')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.REVERT_IMPORT)
  async revert(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    try {
      const result = await this.revertHandler.execute({
        batchId: id,
        organizationId: user.organizationId,
        revertedBy: user.sub,
      });
      return { data: result };
    } catch (err) {
      this.mapDomainError(err);
    }
  }

  /** Paginated import history. */
  @Get()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_IMPORT)
  async list(
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('status') status: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.historyHandler.execute({
      organizationId: user.organizationId,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      status: status as any,
    });
    return { data: result };
  }

  /** Single batch detail. */
  @Get(':id')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_IMPORT)
  async getOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const batch = await this.batchRepo.findById(id, user.organizationId);
    if (!batch) throw new NotFoundException(`Import batch not found: ${id}`);
    return { data: batch };
  }

  private mapDomainError(error: unknown): never {
    if (error instanceof FileEmptyError) throw new BadRequestException(error.message);
    if (error instanceof ImportBatchNotFoundError) throw new NotFoundException(error.message);
    if (error instanceof InvalidImportTransitionError) throw new ConflictException(error.message);
    if (error instanceof Error && error.message.includes('not configured')) {
      throw new UnprocessableEntityException(error.message);
    }
    throw error;
  }
}
