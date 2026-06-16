// apps/api/src/api/consultations/consultations.controller.ts
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
import type { IConsultationRepository } from '@/domain/consultation/consultation.repository.interface';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import { Action } from '@/domain/shared/rbac-permissions';
import { CreateConsultationUseCase } from '@/application/consultation/commands/create-consultation.use-case';
import { UpdateConsultationUseCase, ForbiddenError } from '@/application/consultation/commands/update-consultation.use-case';
import { SoftDeleteConsultationUseCase } from '@/application/consultation/commands/soft-delete-consultation.use-case';
import { GetConsultationUseCase } from '@/application/consultation/queries/get-consultation.use-case';
import { ListConsultationsUseCase } from '@/application/consultation/queries/list-consultations.use-case';
import { SearchConsultationLogsUseCase } from '@/application/consultation/queries/search-consultation-logs.use-case';
import { ConsultationNotFoundError } from '@/domain/consultation/errors/consultation-not-found.error';
import { PatientNotActiveError } from '@/domain/consultation/errors/patient-not-active.error';
import { DateInFutureError } from '@/domain/consultation/errors/date-in-future.error';
import { InvalidDiagnosisCodeError } from '@/domain/consultation/errors/invalid-diagnosis-code.error';
import { InvalidProcedureCodeError } from '@/domain/consultation/errors/invalid-procedure-code.error';
import {
  CreateConsultationSchema,
  UpdateConsultationSchema,
  ListConsultationsQuerySchema,
  SearchConsultationLogsSchema,
} from '@medicore/contracts';
import { ZodValidationPipe } from '@/api/shared/pipes/zod-validation.pipe';

@Controller('patients/:patientId/consultations')
@UseGuards(AuthGuard, RBACGuard)
export class ConsultationsController {
  private readonly createConsultationUseCase: CreateConsultationUseCase;
  private readonly updateConsultationUseCase: UpdateConsultationUseCase;
  private readonly softDeleteConsultationUseCase: SoftDeleteConsultationUseCase;
  private readonly getConsultationUseCase: GetConsultationUseCase;
  private readonly listConsultationsUseCase: ListConsultationsUseCase;
  private readonly searchConsultationLogsUseCase: SearchConsultationLogsUseCase;

  constructor(
    @Inject('IConsultationRepository') consultationRepo: IConsultationRepository,
    @Inject('IPatientRepository') patientRepo: IPatientRepository,
    @Inject('REPORT_QUEUE') private readonly reportQueue: { add: (name: string, data: Record<string, string>) => Promise<unknown> },
  ) {
    this.createConsultationUseCase = new CreateConsultationUseCase(consultationRepo, patientRepo, this.reportQueue);
    this.updateConsultationUseCase = new UpdateConsultationUseCase(consultationRepo);
    this.softDeleteConsultationUseCase = new SoftDeleteConsultationUseCase(consultationRepo);
    this.getConsultationUseCase = new GetConsultationUseCase(consultationRepo);
    this.listConsultationsUseCase = new ListConsultationsUseCase(consultationRepo);
    this.searchConsultationLogsUseCase = new SearchConsultationLogsUseCase(consultationRepo);
  }

  @Post()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.CREATE_CONSULTATION)
  async create(
    @Param('patientId') patientId: string,
    @Body(new ZodValidationPipe(CreateConsultationSchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.createConsultationUseCase.execute({
        organizationId: user.organizationId,
        patientId,
        date: new Date(body.date),
        type: body.type,
        physicianId: user.sub,
        chiefComplaint: body.chiefComplaint,
        currentIllness: body.currentIllness ?? null,
        physicalExam: body.physicalExam ?? null,
        assessment: body.assessment ?? null,
        diagnosisCodes: body.diagnosisCodes ?? null,
        plan: body.plan ?? null,
        procedureCodes: body.procedureCodes ?? null,
        followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
        followUpNotes: body.followUpNotes ?? null,
        createdBy: user.sub,
        generateReport: body.generateReport ?? false,
      });

      return {
        ...this.toResponse(result.consultation),
        firstVisitWarning: result.firstVisitWarning,
        reportQueued: result.reportQueued,
      };
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  @Get()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_CONSULTATION)
  async list(
    @Param('patientId') patientId: string,
    @Query() query: any,
    @CurrentUser() user: JwtPayload,
  ) {
    const parsed = ListConsultationsQuerySchema.parse(query);

    const result = await this.listConsultationsUseCase.execute({
      patientId,
      organizationId: user.organizationId,
      page: parsed.page,
      pageSize: parsed.pageSize,
      from: parsed.from ? new Date(parsed.from) : undefined,
      to: parsed.to ? new Date(parsed.to) : undefined,
      type: parsed.type,
      sortBy: parsed.sortBy,
      sortOrder: parsed.sortOrder,
    });

    return result;
  }

  @Post('search-logs')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_CONSULTATION)
  async searchLogs(
    @Param('patientId') patientId: string,
    @Body(new ZodValidationPipe(SearchConsultationLogsSchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.searchConsultationLogsUseCase.execute(
      patientId,
      user.organizationId,
      body,
    );

    return {
      items: result.items.map((c) => this.toResponse(c)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  @Get(':consultationId')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_CONSULTATION)
  async get(
    @Param('patientId') _patientId: string,
    @Param('consultationId') consultationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.getConsultationUseCase.execute({
        id: consultationId,
        organizationId: user.organizationId,
      });
      return this.toResponse(result);
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  @Patch(':consultationId')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.UPDATE_CONSULTATION_OWN)
  async update(
    @Param('patientId') _patientId: string,
    @Param('consultationId') consultationId: string,
    @Body(new ZodValidationPipe(UpdateConsultationSchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.updateConsultationUseCase.execute({
        id: consultationId,
        organizationId: user.organizationId,
        role: user.role,
        userId: user.sub,
        date: body.date ? new Date(body.date) : undefined,
        type: body.type,
        chiefComplaint: body.chiefComplaint,
        currentIllness: body.currentIllness,
        physicalExam: body.physicalExam,
        assessment: body.assessment,
        diagnosisCodes: body.diagnosisCodes,
        plan: body.plan,
        procedureCodes: body.procedureCodes,
        followUpDate: body.followUpDate ? new Date(body.followUpDate) : body.followUpDate === null ? null : undefined,
        followUpNotes: body.followUpNotes,
      });
      return this.toResponse(result);
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  @Delete(':consultationId')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.DELETE_CONSULTATION)
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('patientId') _patientId: string,
    @Param('consultationId') consultationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.softDeleteConsultationUseCase.execute({
        id: consultationId,
        organizationId: user.organizationId,
        role: user.role,
        userId: user.sub,
      });
      return this.toResponse(result);
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  private toResponse(consultation: any) {
    return {
      id: consultation.id,
      patientId: consultation.patientId,
      organizationId: consultation.organizationId,
      date: consultation.date instanceof Date ? consultation.date.toISOString() : consultation.date,
      type: consultation.type,
      physicianId: consultation.physicianId,
      physicianName: consultation.physicianName,
      chiefComplaint: consultation.chiefComplaint,
      currentIllness: consultation.currentIllness,
      physicalExam: consultation.physicalExam,
      assessment: consultation.assessment,
      diagnosisCodes: consultation.diagnosisCodes,
      plan: consultation.plan,
      procedureCodes: consultation.procedureCodes,
      followUpDate: consultation.followUpDate instanceof Date ? consultation.followUpDate.toISOString() : consultation.followUpDate,
      followUpNotes: consultation.followUpNotes,
      createdBy: consultation.createdBy,
      updatedBy: consultation.updatedBy,
      createdAt: consultation.createdAt instanceof Date ? consultation.createdAt.toISOString() : consultation.createdAt,
      updatedAt: consultation.updatedAt instanceof Date ? consultation.updatedAt.toISOString() : consultation.updatedAt,
      deletedAt: consultation.deletedAt ? (consultation.deletedAt instanceof Date ? consultation.deletedAt.toISOString() : consultation.deletedAt) : null,
    };
  }

  private mapDomainError(error: unknown): never {
    if (error instanceof ConsultationNotFoundError) {
      throw new NotFoundException(error.message);
    }
    if (error instanceof PatientNotActiveError) {
      throw new UnprocessableEntityException(error.message);
    }
    if (error instanceof DateInFutureError) {
      throw new UnprocessableEntityException(error.message);
    }
    if (error instanceof InvalidDiagnosisCodeError) {
      throw new BadRequestException(error.message);
    }
    if (error instanceof InvalidProcedureCodeError) {
      throw new BadRequestException(error.message);
    }
    if (error instanceof ForbiddenError) {
      throw new ForbiddenException(error.message);
    }
    throw error;
  }
}
