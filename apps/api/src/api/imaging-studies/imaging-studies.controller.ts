// apps/api/src/api/imaging-studies/imaging-studies.controller.ts
// 6 endpoints: list, create, update, upload files, presigned URL, soft delete
// All require AuthGuard + RBACGuard

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import type { JwtPayload } from '@medicore/contracts';
import type { IImagingStudyRepository } from '@/domain/imaging/imaging-study.repository.interface';
import type { IPendingDeletionRepository } from '@/domain/imaging/pending-deletion.repository.interface';
import type { IStorageService } from '@/domain/shared/storage.interface';
import { Action } from '@/domain/shared/rbac-permissions';
import { CreateImagingStudyUseCase } from '@/application/imaging/commands/create-imaging-study.use-case';
import { UpdateImagingStudyUseCase, ForbiddenError as UpdateForbiddenError } from '@/application/imaging/commands/update-imaging-study.use-case';
import { SoftDeleteImagingStudyUseCase } from '@/application/imaging/commands/soft-delete-imaging-study.use-case';
import { UploadFilesUseCase } from '@/application/imaging/commands/upload-files.use-case';
import { GetImagingStudyUseCase } from '@/application/imaging/queries/get-imaging-study.use-case';
import { ListImagingStudiesUseCase } from '@/application/imaging/queries/list-imaging-studies.use-case';
import { GetPresignedUrlUseCase } from '@/application/imaging/queries/get-presigned-url.use-case';
import { ImagingStudyNotFoundError } from '@/domain/imaging/errors/imaging-study-not-found.error';
import { StudyAlreadyDeletedError } from '@/domain/imaging/errors/study-already-deleted.error';
import { InvalidMimeTypeError } from '@/domain/imaging/errors/invalid-mime-type.error';
import { FileTooLargeError } from '@/domain/imaging/errors/file-too-large.error';
import { FileCountExceededError } from '@/domain/imaging/errors/file-count-exceeded.error';
import { InvalidImagingStudyIdError } from '@/domain/imaging/errors/invalid-imaging-study-id.error';
import { FileValidationPipe } from './pipes/file-validation.pipe';
import { ZodValidationPipe } from '@/api/shared/pipes/zod-validation.pipe';
import {
  CreateImagingStudySchema,
  UpdateImagingStudySchema,
  ListImagingStudiesQuerySchema,
} from '@medicore/contracts';
import type {
  ImagingStudyResponseDto,
  ListImagingStudiesResponseDto,
  UploadFilesResponseDto,
  PresignedUrlResponseDto,
} from './dto/upload-files.dto';

const MAX_FILES_UPLOAD = 20; // Max files per upload request (separate from per-study limit of 100)

@Controller('patients/:patientId/imaging')
@UseGuards(AuthGuard, RBACGuard)
export class ImagingStudiesController {
  private readonly createUseCase: CreateImagingStudyUseCase;
  private readonly updateUseCase: UpdateImagingStudyUseCase;
  private readonly softDeleteUseCase: SoftDeleteImagingStudyUseCase;
  private readonly uploadFilesUseCase: UploadFilesUseCase;
  private readonly getUseCase: GetImagingStudyUseCase;
  private readonly listUseCase: ListImagingStudiesUseCase;
  private readonly getPresignedUrlUseCase: GetPresignedUrlUseCase;

  constructor(
    @Inject('IImagingStudyRepository') imagingRepo: IImagingStudyRepository,
    @Inject('IPendingDeletionRepository') pendingDeletionRepo: IPendingDeletionRepository,
    @Inject('IStorageService') storageService: IStorageService,
    @Inject('IMAGING_QUEUE') imagingQueue: { add: (name: string, data: Record<string, string>) => Promise<unknown> },
    @Inject('PENDING_DELETIONS_QUEUE') deletionQueue: { add: (name: string, data: Record<string, string>) => Promise<unknown> },
  ) {
    this.createUseCase = new CreateImagingStudyUseCase(imagingRepo);
    this.updateUseCase = new UpdateImagingStudyUseCase(imagingRepo);
    this.softDeleteUseCase = new SoftDeleteImagingStudyUseCase(imagingRepo, pendingDeletionRepo, deletionQueue);
    this.uploadFilesUseCase = new UploadFilesUseCase(imagingRepo, storageService, imagingQueue);
    this.getUseCase = new GetImagingStudyUseCase(imagingRepo);
    this.listUseCase = new ListImagingStudiesUseCase(imagingRepo);
    this.getPresignedUrlUseCase = new GetPresignedUrlUseCase(imagingRepo, storageService);
  }

  @Get()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_IMAGING)
  async list(
    @Param('patientId') patientId: string,
    @Query() query: any,
    @CurrentUser() user: JwtPayload,
  ): Promise<ListImagingStudiesResponseDto> {
    const parsed = ListImagingStudiesQuerySchema.parse(query);

    const result = await this.listUseCase.execute({
      patientId,
      organizationId: user.organizationId,
      page: parsed.page,
      pageSize: parsed.pageSize,
      sortBy: parsed.sortBy,
      sortOrder: parsed.sortOrder,
      type: parsed.type,
      from: parsed.from ? new Date(parsed.from) : undefined,
      to: parsed.to ? new Date(parsed.to) : undefined,
    });

    return {
      ...result,
      items: result.items.map((s) => this.toResponse(s)),
    };
  }

  @Post()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.CREATE_IMAGING)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('patientId') patientId: string,
    @Body(new ZodValidationPipe(CreateImagingStudySchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ): Promise<ImagingStudyResponseDto> {
    try {
      const result = await this.createUseCase.execute({
        organizationId: user.organizationId,
        patientId,
        type: body.type,
        date: new Date(body.date),
        description: body.description ?? null,
        surgeryId: body.surgeryId ?? null,
        consultationId: body.consultationId ?? null,
        createdBy: user.sub,
      });
      return this.toResponse(result);
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  @Get(':studyId')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_IMAGING)
  async get(
    @Param('patientId') _patientId: string,
    @Param('studyId') studyId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ImagingStudyResponseDto> {
    try {
      const result = await this.getUseCase.execute({
        id: studyId,
        organizationId: user.organizationId,
      });
      return this.toResponse(result);
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  @Patch(':studyId')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.UPDATE_IMAGING)
  async update(
    @Param('patientId') _patientId: string,
    @Param('studyId') studyId: string,
    @Body(new ZodValidationPipe(UpdateImagingStudySchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ): Promise<ImagingStudyResponseDto> {
    try {
      const result = await this.updateUseCase.execute({
        id: studyId,
        organizationId: user.organizationId,
        role: user.role,
        userId: user.sub,
        type: body.type,
        date: body.date ? new Date(body.date) : undefined,
        description: body.description,
        findings: body.findings,
        labels: body.labels,
        surgeryId: body.surgeryId,
        consultationId: body.consultationId,
      });
      return this.toResponse(result);
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  @Post(':studyId/files')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.CREATE_IMAGING)
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_UPLOAD))
  async uploadFiles(
    @Param('patientId') patientId: string,
    @Param('studyId') studyId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: JwtPayload,
  ): Promise<UploadFilesResponseDto> {
    try {
      // Get existing study to know current file count for validation
      const study = await this.getUseCase.execute({
        id: studyId,
        organizationId: user.organizationId,
      });

      // Validate files (MIME, size, count)
      const validationPipe = new FileValidationPipe(study.files.length);
      const validatedFiles = validationPipe.transform(files);

      const result = await this.uploadFilesUseCase.execute({
        studyId,
        organizationId: user.organizationId,
        patientId,
        files: validatedFiles,
      });

      return result;
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  @Get(':studyId/files/:fileKey/url')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_IMAGING)
  async getPresignedUrl(
    @Param('patientId') _patientId: string,
    @Param('studyId') studyId: string,
    @Param('fileKey') fileKey: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<PresignedUrlResponseDto> {
    try {
      // Decode fileKey if URL-encoded
      const decodedKey = decodeURIComponent(fileKey);

      const result = await this.getPresignedUrlUseCase.execute({
        studyId,
        organizationId: user.organizationId,
        fileKey: decodedKey,
      });

      return {
        url: result.url,
        expiresAt: result.expiresAt.toISOString(),
      };
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  @Delete(':studyId')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.DELETE_IMAGING)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('patientId') _patientId: string,
    @Param('studyId') studyId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    try {
      await this.softDeleteUseCase.execute({
        id: studyId,
        organizationId: user.organizationId,
        role: user.role,
        userId: user.sub,
      });
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  private toResponse(study: any): ImagingStudyResponseDto {
    return {
      id: study.id,
      organizationId: study.organizationId,
      patientId: study.patientId,
      surgeryId: study.surgeryId ?? null,
      consultationId: study.consultationId ?? null,
      type: study.type,
      date: study.date instanceof Date ? study.date.toISOString() : study.date,
      description: study.description ?? null,
      findings: study.findings ?? null,
      labels: study.labels ?? null,
      files: study.files ?? [],
      createdBy: study.createdBy,
      updatedBy: study.updatedBy ?? null,
      createdAt: study.createdAt instanceof Date ? study.createdAt.toISOString() : study.createdAt,
      updatedAt: study.updatedAt instanceof Date ? study.updatedAt.toISOString() : study.updatedAt,
      deletedAt: study.deletedAt ? (study.deletedAt instanceof Date ? study.deletedAt.toISOString() : study.deletedAt) : null,
    };
  }

  private mapDomainError(error: unknown): never {
    if (error instanceof InvalidImagingStudyIdError) {
      throw new BadRequestException({
        statusCode: 400,
        error: error.code,
        message: error.message,
      });
    }
    if (error instanceof ImagingStudyNotFoundError) {
      throw new NotFoundException(error.message);
    }
    if (error instanceof StudyAlreadyDeletedError) {
      throw new UnprocessableEntityException(error.message);
    }
    if (error instanceof InvalidMimeTypeError) {
      throw new UnprocessableEntityException({ statusCode: 422, error: 'INVALID_MIME_TYPE', message: error.message, details: [{ mimeType: error.mimeType, allowed: error.allowed }] });
    }
    if (error instanceof FileTooLargeError) {
      throw new UnprocessableEntityException({ statusCode: 422, error: 'FILE_TOO_LARGE', message: error.message, details: [{ fileName: error.fileName, size: error.size, maxSize: error.maxSize }] });
    }
    if (error instanceof FileCountExceededError) {
      throw new UnprocessableEntityException({ statusCode: 422, error: 'FILE_COUNT_EXCEEDED', message: error.message, details: [{ currentCount: error.currentCount, additionCount: error.additionCount, maxCount: error.maxCount }] });
    }
    if (error instanceof UpdateForbiddenError) {
      throw new ForbiddenException(error.message);
    }
    throw error;
  }
}
