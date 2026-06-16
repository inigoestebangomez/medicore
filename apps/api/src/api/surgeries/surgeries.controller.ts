// apps/api/src/api/surgeries/surgeries.controller.ts
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
  BadRequestException,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import type { JwtPayload } from '@medicore/contracts';
import type { ISurgeryRepository } from '@/domain/surgery/surgery.repository.interface';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import { Action } from '@/domain/shared/rbac-permissions';
import { CreateSurgeryUseCase } from '@/application/surgery/commands/create-surgery.use-case';
import { UpdateSurgeryUseCase, ForbiddenError } from '@/application/surgery/commands/update-surgery.use-case';
import { ChangeSurgeryStatusUseCase } from '@/application/surgery/commands/change-surgery-status.use-case';
import { SoftDeleteSurgeryUseCase } from '@/application/surgery/commands/soft-delete-surgery.use-case';
import { GetSurgeryUseCase } from '@/application/surgery/queries/get-surgery.use-case';
import { ListSurgeriesUseCase } from '@/application/surgery/queries/list-surgeries.use-case';
import { SurgeryNotFoundError } from '@/domain/surgery/errors/surgery-not-found.error';
import { InvalidSurgeryTransitionError } from '@/domain/surgery/errors/invalid-surgery-transition.error';
import { AsaRequiredError } from '@/domain/surgery/errors/asa-required.error';
import { EditReasonRequiredError } from '@/domain/surgery/errors/edit-reason-required.error';
import { InvalidProcedureCodeError } from '@/domain/surgery/errors/invalid-procedure-code.error';
import { PatientNotActiveError } from '@/domain/consultation/errors/patient-not-active.error';
import { DateInFutureError } from '@/domain/consultation/errors/date-in-future.error';
import {
  CreateSurgerySchema,
  UpdateSurgerySchema,
  ChangeSurgeryStatusSchema,
  ListSurgeriesQuerySchema,
} from '@medicore/contracts';
import { ZodValidationPipe } from '@/api/shared/pipes/zod-validation.pipe';

@Controller('patients/:patientId/surgeries')
@UseGuards(AuthGuard, RBACGuard)
export class SurgeriesController {
  private readonly createSurgeryUseCase: CreateSurgeryUseCase;
  private readonly updateSurgeryUseCase: UpdateSurgeryUseCase;
  private readonly changeSurgeryStatusUseCase: ChangeSurgeryStatusUseCase;
  private readonly softDeleteSurgeryUseCase: SoftDeleteSurgeryUseCase;
  private readonly getSurgeryUseCase: GetSurgeryUseCase;
  private readonly listSurgeriesUseCase: ListSurgeriesUseCase;

  constructor(
    @Inject('ISurgeryRepository') surgeryRepo: ISurgeryRepository,
    @Inject('IPatientRepository') patientRepo: IPatientRepository,
    @Inject('REPORT_QUEUE') private readonly reportQueue: { add: (name: string, data: Record<string, string>) => Promise<unknown> },
  ) {
    this.createSurgeryUseCase = new CreateSurgeryUseCase(surgeryRepo, patientRepo, this.reportQueue);
    this.updateSurgeryUseCase = new UpdateSurgeryUseCase(surgeryRepo);
    this.changeSurgeryStatusUseCase = new ChangeSurgeryStatusUseCase(surgeryRepo);
    this.softDeleteSurgeryUseCase = new SoftDeleteSurgeryUseCase(surgeryRepo);
    this.getSurgeryUseCase = new GetSurgeryUseCase(surgeryRepo);
    this.listSurgeriesUseCase = new ListSurgeriesUseCase(surgeryRepo);
  }

  @Post()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.CREATE_SURGERY)
  async create(
    @Param('patientId') patientId: string,
    @Body(new ZodValidationPipe(CreateSurgerySchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.createSurgeryUseCase.execute({
        organizationId: user.organizationId,
        patientId,
        date: new Date(body.date),
        procedureType: body.procedureType,
        procedureCodes: body.procedureCodes ?? null,
        asa: body.asa ?? null,
        anesthesiaType: body.anesthesiaType ?? null,
        preOpNotes: body.preOpNotes ?? null,
        preOpChecklist: body.preOpChecklist ?? null,
        duration: body.duration ?? null,
        technique: body.technique ?? null,
        findings: body.findings ?? null,
        complications: body.complications ?? null,
        postOpNotes: body.postOpNotes ?? null,
        postOpProtocol: body.postOpProtocol ?? null,
        outcome: body.outcome ?? null,
        physicianId: user.sub,
        createdBy: user.sub,
        generateReport: body.generateReport ?? false,
      });

      return {
        ...this.toResponse(result.surgery),
        consentWarning: result.consentWarning,
        reportQueued: result.reportQueued,
      };
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  @Get()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_SURGERY)
  async list(
    @Param('patientId') patientId: string,
    @Query() query: any,
    @CurrentUser() user: JwtPayload,
  ) {
    const parsed = ListSurgeriesQuerySchema.parse(query);

    const result = await this.listSurgeriesUseCase.execute({
      patientId,
      organizationId: user.organizationId,
      page: parsed.page,
      pageSize: parsed.pageSize,
      from: parsed.from ? new Date(parsed.from) : undefined,
      to: parsed.to ? new Date(parsed.to) : undefined,
      status: parsed.status,
      sortBy: parsed.sortBy,
      sortOrder: parsed.sortOrder,
    });

    return result;
  }

  @Get(':surgeryId')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_SURGERY)
  async get(
    @Param('patientId') _patientId: string,
    @Param('surgeryId') surgeryId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.getSurgeryUseCase.execute({
        id: surgeryId,
        organizationId: user.organizationId,
      });
      return this.toResponse(result);
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  @Patch(':surgeryId')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.UPDATE_SURGERY_OWN)
  async update(
    @Param('patientId') _patientId: string,
    @Param('surgeryId') surgeryId: string,
    @Body(new ZodValidationPipe(UpdateSurgerySchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.updateSurgeryUseCase.execute({
        id: surgeryId,
        organizationId: user.organizationId,
        role: user.role,
        userId: user.sub,
        procedureType: body.procedureType,
        procedureCodes: body.procedureCodes,
        asa: body.asa,
        anesthesiaType: body.anesthesiaType,
        preOpNotes: body.preOpNotes,
        preOpChecklist: body.preOpChecklist,
        duration: body.duration,
        technique: body.technique,
        findings: body.findings,
        complications: body.complications,
        postOpNotes: body.postOpNotes,
        postOpProtocol: body.postOpProtocol,
        outcome: body.outcome,
        editReason: body.editReason,
      });
      return this.toResponse(result);
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  @Post(':surgeryId/change-status')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.UPDATE_SURGERY_OWN)
  async changeStatus(
    @Param('patientId') patientId: string,
    @Param('surgeryId') surgeryId: string,
    @Body(new ZodValidationPipe(ChangeSurgeryStatusSchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.changeSurgeryStatusUseCase.execute({
        id: surgeryId,
        organizationId: user.organizationId,
        patientId,
        role: user.role,
        userId: user.sub,
        targetStatus: body.targetStatus,
        asa: body.asa,
        date: body.date ? new Date(body.date) : undefined,
        statusReason: body.statusReason,
      });
      return this.toResponse(result);
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  @Delete(':surgeryId')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.DELETE_SURGERY)
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('patientId') _patientId: string,
    @Param('surgeryId') surgeryId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.softDeleteSurgeryUseCase.execute({
        id: surgeryId,
        organizationId: user.organizationId,
        role: user.role,
        userId: user.sub,
      });
      return this.toResponse(result);
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  private toResponse(surgery: any) {
    return {
      id: surgery.id,
      patientId: surgery.patientId,
      organizationId: surgery.organizationId,
      date: surgery.date instanceof Date ? surgery.date.toISOString() : surgery.date,
      status: surgery.status,
      procedureType: surgery.procedureType,
      procedureCodes: surgery.procedureCodes,
      asa: surgery.asa,
      anesthesiaType: surgery.anesthesiaType,
      preOpNotes: surgery.preOpNotes,
      preOpChecklist: surgery.preOpChecklist,
      duration: surgery.duration,
      technique: surgery.technique,
      findings: surgery.findings,
      complications: surgery.complications,
      postOpNotes: surgery.postOpNotes,
      postOpProtocol: surgery.postOpProtocol,
      outcome: surgery.outcome,
      editReason: surgery.editReason,
      physicianId: surgery.physicianId,
      createdBy: surgery.createdBy,
      updatedBy: surgery.updatedBy,
      createdAt: surgery.createdAt instanceof Date ? surgery.createdAt.toISOString() : surgery.createdAt,
      updatedAt: surgery.updatedAt instanceof Date ? surgery.updatedAt.toISOString() : surgery.updatedAt,
      deletedAt: surgery.deletedAt ? (surgery.deletedAt instanceof Date ? surgery.deletedAt.toISOString() : surgery.deletedAt) : null,
    };
  }

  private mapDomainError(error: unknown): never {
    if (error instanceof SurgeryNotFoundError) {
      throw new NotFoundException(error.message);
    }
    if (error instanceof PatientNotActiveError) {
      throw new UnprocessableEntityException(error.message);
    }
    if (error instanceof InvalidSurgeryTransitionError) {
      throw new UnprocessableEntityException({
        message: error.message,
        fromStatus: error.fromStatus,
        toStatus: error.toStatus,
      });
    }
    if (error instanceof AsaRequiredError) {
      throw new UnprocessableEntityException(error.message);
    }
    if (error instanceof EditReasonRequiredError) {
      throw new UnprocessableEntityException(error.message);
    }
    if (error instanceof InvalidProcedureCodeError) {
      throw new BadRequestException(error.message);
    }
    if (error instanceof DateInFutureError) {
      throw new UnprocessableEntityException(error.message);
    }
    if (error instanceof ForbiddenError) {
      throw new ForbiddenException(error.message);
    }
    throw error;
  }
}