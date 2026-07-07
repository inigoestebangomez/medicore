// apps/api/src/api/scales/scales.controller.ts
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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import type { JwtPayload } from '@medicore/contracts';
import type { IClinicalScaleRepository } from '@/domain/scale/scale.repository.interface';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import { Action } from '@/domain/shared/rbac-permissions';
import { CreateClinicalScaleUseCase } from '@/application/scale/commands/create-clinical-scale.use-case';
import { UpdateClinicalScaleUseCase } from '@/application/scale/commands/update-clinical-scale.use-case';
import { SoftDeleteClinicalScaleUseCase } from '@/application/scale/commands/soft-delete-clinical-scale.use-case';
import { GetScaleUseCase } from '@/application/scale/queries/get-scale.use-case';
import { ListScalesUseCase } from '@/application/scale/queries/list-scales.use-case';
import { ClinicalScaleNotFoundError } from '@/domain/scale/errors/clinical-scale-not-found.error';
import { InvalidScaleScoresError } from '@/domain/scale/errors/invalid-scale-scores.error';
import { InvalidScaleTypeError } from '@/domain/scale/errors/invalid-scale-type.error';
import { PatientNotActiveError } from '@/domain/consultation/errors/patient-not-active.error';
import {
  CreateScaleSchema,
  UpdateScaleSchema,
  ListScalesQuerySchema,
} from '@medicore/contracts';
import { ZodValidationPipe } from '@/api/shared/pipes/zod-validation.pipe';

@Controller('patients/:patientId/scales')
@UseGuards(AuthGuard, RBACGuard)
export class ScalesController {
  private readonly createScaleUseCase: CreateClinicalScaleUseCase;
  private readonly updateScaleUseCase: UpdateClinicalScaleUseCase;
  private readonly softDeleteScaleUseCase: SoftDeleteClinicalScaleUseCase;
  private readonly getScaleUseCase: GetScaleUseCase;
  private readonly listScalesUseCase: ListScalesUseCase;

  constructor(
    @Inject('IClinicalScaleRepository') scaleRepo: IClinicalScaleRepository,
    @Inject('IPatientRepository') patientRepo: IPatientRepository,
  ) {
    this.createScaleUseCase = new CreateClinicalScaleUseCase(scaleRepo, patientRepo);
    this.updateScaleUseCase = new UpdateClinicalScaleUseCase(scaleRepo);
    this.softDeleteScaleUseCase = new SoftDeleteClinicalScaleUseCase(scaleRepo);
    this.getScaleUseCase = new GetScaleUseCase(scaleRepo);
    this.listScalesUseCase = new ListScalesUseCase(scaleRepo);
  }

  @Post()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.CREATE_SCALE)
  async create(
    @Param('patientId') patientId: string,
    @Body(new ZodValidationPipe(CreateScaleSchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.createScaleUseCase.execute({
        organizationId: user.organizationId,
        patientId,
        consultationId: body.consultationId,
        scaleType: body.scaleType,
        date: body.date ? new Date(body.date) : undefined,
        scores: body.scores,
        notes: body.notes,
        createdBy: user.sub,
      });
      return this.toResponse(result);
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  @Get()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_SCALE)
  async list(
    @Param('patientId') patientId: string,
    @Query() query: any,
    @CurrentUser() user: JwtPayload,
  ) {
    const parsed = ListScalesQuerySchema.parse(query);

    const result = await this.listScalesUseCase.execute({
      patientId,
      organizationId: user.organizationId,
      page: parsed.page,
      pageSize: parsed.pageSize,
      scaleType: parsed.scaleType,
      from: parsed.from ? new Date(parsed.from) : undefined,
      to: parsed.to ? new Date(parsed.to) : undefined,
    });

    return {
      items: result.items.map(s => this.toResponse(s)),
      total: result.total,
      page: parsed.page,
      pageSize: parsed.pageSize,
    };
  }

  @Get(':scaleId')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_SCALE)
  async get(
    @Param('patientId') _patientId: string,
    @Param('scaleId') scaleId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.getScaleUseCase.execute({
        id: scaleId,
        organizationId: user.organizationId,
      });
      return this.toResponse(result);
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  @Patch(':scaleId')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.CREATE_SCALE)
  async update(
    @Param('patientId') _patientId: string,
    @Param('scaleId') scaleId: string,
    @Body(new ZodValidationPipe(UpdateScaleSchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.updateScaleUseCase.execute({
        id: scaleId,
        organizationId: user.organizationId,
        scores: body.scores,
        notes: body.notes,
        userId: user.sub,
      });
      return this.toResponse(result);
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  @Delete(':scaleId')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.CREATE_SCALE)
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('patientId') _patientId: string,
    @Param('scaleId') scaleId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.softDeleteScaleUseCase.execute({
        id: scaleId,
        organizationId: user.organizationId,
        userId: user.sub,
      });
      return this.toResponse(result);
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  private toResponse(scale: any) {
    return {
      id: scale.id,
      patientId: scale.patientId,
      organizationId: scale.organizationId,
      consultationId: scale.consultationId,
      scaleType: scale.scaleType,
      date: scale.date instanceof Date ? scale.date.toISOString() : scale.date,
      scores: scale.scores,
      total: scale.total,
      notes: scale.notes,
      createdBy: scale.createdBy,
      updatedBy: scale.updatedBy,
      createdAt: scale.createdAt instanceof Date ? scale.createdAt.toISOString() : scale.createdAt,
      updatedAt: scale.updatedAt instanceof Date ? scale.updatedAt.toISOString() : scale.updatedAt,
    };
  }

  private mapDomainError(error: unknown): never {
    if (error instanceof ClinicalScaleNotFoundError) {
      throw new NotFoundException(error.message);
    }
    if (error instanceof PatientNotActiveError) {
      throw new UnprocessableEntityException(error.message);
    }
    if (error instanceof InvalidScaleScoresError) {
      throw new UnprocessableEntityException({
        message: error.message,
        code: error.code,
        scaleType: error.scaleType,
      });
    }
    if (error instanceof InvalidScaleTypeError) {
      throw new UnprocessableEntityException({
        message: error.message,
        code: error.code,
      });
    }
    throw error;
  }
}