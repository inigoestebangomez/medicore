import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import type { JwtPayload } from '@medicore/contracts';
import type { IReportRepository } from '@/domain/report/report.repository.interface';
import type { IConsultationRepository } from '@/domain/consultation/consultation.repository.interface';
import type { ISurgeryRepository } from '@/domain/surgery/surgery.repository.interface';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import { AI_PROVIDER, type AiProvider } from '@/infrastructure/billing/ai-provider/ai-provider.interface';
import { AiUsageGuard } from '@/api/shared/guards/ai-usage.guard';
import { AuditLogService } from '@/infrastructure/audit/audit-log.service';
import { Action } from '@/domain/shared/rbac-permissions';
import { GenerateReportUseCase } from '@/application/report/generate-report.use-case';
import { SignReportUseCase } from '@/application/report/sign-report.use-case';
import { CreateManualReportUseCase } from '@/application/report/create-manual-report.use-case';
import { UpdateReportUseCase } from '@/application/report/update-report.use-case';
import { ReportNotFoundError } from '@/domain/report/errors/report-not-found.error';
import { ReportImmutableError } from '@/domain/report/errors/report-immutable.error';
import { InvalidReportTransitionError } from '@/domain/report/errors/invalid-report-transition.error';

@Controller('patients/:patientId/reports')
@UseGuards(AuthGuard, RBACGuard)
export class ReportsController {
  private readonly generateReportUseCase: GenerateReportUseCase;
  private readonly signReportUseCase: SignReportUseCase;
  private readonly createManualReportUseCase: CreateManualReportUseCase;
  private readonly updateReportUseCase: UpdateReportUseCase;

  constructor(
    @Inject('IReportRepository') private readonly reportRepo: IReportRepository,
    @Inject('IConsultationRepository') consultationRepo: IConsultationRepository,
    @Inject('ISurgeryRepository') surgeryRepo: ISurgeryRepository,
    @Inject('IPatientRepository') patientRepo: IPatientRepository,
    @Inject(AI_PROVIDER) aiProvider: AiProvider,
    auditLog: AuditLogService,
  ) {
    this.generateReportUseCase = new GenerateReportUseCase(
      reportRepo, consultationRepo, surgeryRepo, patientRepo, aiProvider, auditLog,
    );
    this.signReportUseCase = new SignReportUseCase(reportRepo, auditLog);
    this.createManualReportUseCase = new CreateManualReportUseCase(reportRepo, auditLog);
    this.updateReportUseCase = new UpdateReportUseCase(reportRepo, auditLog);
  }

  @Get()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_REPORT)
  async list(
    @Param('patientId') patientId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const reports = await this.reportRepo.findByPatient(patientId, user.organizationId);
    return { data: reports.map((r) => this.toResponse(r)) };
  }

  @Post('generate')
  @UseGuards(AiUsageGuard)
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.CREATE_REPORT)
  async generate(
    @Param('patientId') patientId: string,
    @Body() body: { type: string; sourceType: string; sourceId: string; title?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    const report = await this.generateReportUseCase.execute({
      sourceType: body.sourceType as 'consultation' | 'surgery',
      sourceId: body.sourceId,
      patientId,
      organizationId: user.organizationId,
      physicianId: user.sub,
      physicianName: user.email ?? user.sub,
      reportType: body.type as any,
      title: body.title,
    });

    return {
      data: {
        reportId: report.id,
        status: report.status,
        message: 'Generando informe. Consulta el estado en GET /v1/patients/:patientId/reports/:reportId',
      },
    };
  }

  @Post()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.CREATE_REPORT)
  async createManual(
    @Param('patientId') patientId: string,
    @Body() body: { type: string; title: string; content: string; diagnosisCodes?: any[]; procedureCodes?: any[] },
    @CurrentUser() user: JwtPayload,
  ) {
    const report = await this.createManualReportUseCase.execute({
      organizationId: user.organizationId,
      patientId,
      physicianId: user.sub,
      type: body.type as any,
      title: body.title,
      content: body.content,
      diagnosisCodes: body.diagnosisCodes,
      procedureCodes: body.procedureCodes,
    });

    return { data: this.toResponse(report) };
  }

  @Get(':reportId')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_REPORT)
  async get(
    @Param('patientId') _patientId: string,
    @Param('reportId') reportId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const report = await this.reportRepo.findById(reportId, user.organizationId);
    if (!report) {
      throw new NotFoundException(`Report not found: ${reportId}`);
    }
    return { data: this.toResponse(report) };
  }

  @Patch(':reportId')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.CREATE_REPORT)
  async update(
    @Param('patientId') _patientId: string,
    @Param('reportId') reportId: string,
    @Body() body: { title?: string; content?: string; status?: string; diagnosisCodes?: any[]; procedureCodes?: any[] },
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const report = await this.updateReportUseCase.execute({
        reportId,
        organizationId: user.organizationId,
        physicianId: user.sub,
        title: body.title,
        content: body.content,
        status: body.status,
        diagnosisCodes: body.diagnosisCodes,
        procedureCodes: body.procedureCodes,
      });
      return { data: this.toResponse(report) };
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  @Post(':reportId/sign')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.SIGN_REPORT)
  async sign(
    @Param('patientId') _patientId: string,
    @Param('reportId') reportId: string,
    @Body() body: { confirmDisclaimer: boolean },
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const report = await this.signReportUseCase.execute({
        reportId,
        organizationId: user.organizationId,
        physicianId: user.sub,
        confirmDisclaimer: body.confirmDisclaimer,
      });
      return {
        data: {
          reportId: report.id,
          status: report.status,
          signedAt: report.signedAt,
          signedBy: report.signedBy,
          message: 'PDF generándose. Disponible en breve en Report.pdfUrl',
        },
      };
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  private toResponse(report: any) {
    return {
      id: report.id,
      type: report.type,
      status: report.status,
      title: report.title,
      content: report.content,
      sourceType: report.sourceType,
      sourceId: report.sourceId,
      diagnosisCodes: report.diagnosisCodes,
      procedureCodes: report.procedureCodes,
      aiGenerated: report.aiGenerated,
      aiModel: report.aiModel,
      aiPromptHash: report.aiPromptHash,
      pdfUrl: report.pdfUrl,
      pdfGeneratedAt: report.pdfGeneratedAt instanceof Date
        ? report.pdfGeneratedAt.toISOString()
        : report.pdfGeneratedAt,
      signedAt: report.signedAt instanceof Date
        ? report.signedAt.toISOString()
        : report.signedAt,
      signedBy: report.signedBy,
      createdBy: report.createdBy,
      updatedBy: report.updatedBy,
      createdAt: report.createdAt instanceof Date
        ? report.createdAt.toISOString()
        : report.createdAt,
      updatedAt: report.updatedAt instanceof Date
        ? report.updatedAt.toISOString()
        : report.updatedAt,
    };
  }

  private mapDomainError(error: unknown): never {
    if (error instanceof ReportNotFoundError) {
      throw new NotFoundException(error.message);
    }
    if (error instanceof ReportImmutableError) {
      throw new UnprocessableEntityException(error.message);
    }
    if (error instanceof InvalidReportTransitionError) {
      throw new UnprocessableEntityException(error.message);
    }
    if (error instanceof Error && error.message.includes('BR-REP-005')) {
      throw new UnprocessableEntityException(error.message);
    }
    throw error;
  }
}
