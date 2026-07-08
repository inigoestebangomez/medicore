import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import type { JwtPayload } from '@medicore/contracts';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import type { IConsultationRepository } from '@/domain/consultation/consultation.repository.interface';
import type { ISurgeryRepository } from '@/domain/surgery/surgery.repository.interface';
import type { IImagingStudyRepository } from '@/domain/imaging/imaging-study.repository.interface';
import type { IMedicationRepository } from '@/domain/medication/medication.repository.interface';
import type { IClinicalScaleRepository } from '@/domain/scale/scale.repository.interface';
import { Action } from '@/domain/shared/rbac-permissions';
import { ExportPatientHandler } from '@/application/patient/commands/export-patient.use-case';
import { AnonymizePatientHandler } from '@/application/patient/commands/anonymize-patient.use-case';
import { AuditLogService } from '@/infrastructure/audit/audit-log.service';
import { PatientNotFoundError } from '@/domain/patient/errors/patient-not-found.error';

interface ExportJob {
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  result?: unknown;
  createdAt: Date;
}

@Controller()
@UseGuards(AuthGuard, RBACGuard)
export class ExportController {
  private readonly exportPatientUseCase: ExportPatientHandler;
  private readonly anonymizePatientUseCase: AnonymizePatientHandler;
  private readonly jobs = new Map<string, ExportJob>();

  constructor(
    @Inject('IPatientRepository') patientRepo: IPatientRepository,
    @Inject('IConsultationRepository') consultationRepo: IConsultationRepository,
    @Inject('ISurgeryRepository') surgeryRepo: ISurgeryRepository,
    @Inject('IImagingStudyRepository') imagingRepo: IImagingStudyRepository,
    @Inject('IMedicationRepository') medicationRepo: IMedicationRepository,
    @Inject('IClinicalScaleRepository') scaleRepo: IClinicalScaleRepository,
    auditLog: AuditLogService,
  ) {
    this.exportPatientUseCase = new ExportPatientHandler(
      patientRepo,
      consultationRepo,
      surgeryRepo,
      imagingRepo,
      medicationRepo,
      scaleRepo,
      auditLog,
    );
    this.anonymizePatientUseCase = new AnonymizePatientHandler(patientRepo, auditLog);
  }

  // POST /v1/export/patients/:patientId — async job pattern
  @Post('v1/export/patients/:patientId')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.EXPORT_PATIENT)
  async exportPatient(
    @Param('patientId') patientId: string,
    @Body() body: { format?: string; includeDeleted?: boolean; sections?: string[] },
    @CurrentUser() user: JwtPayload,
  ) {
    if (body.format === 'pdf') {
      throw new BadRequestException('PDF export not yet available');
    }

    const jobId = crypto.randomUUID();
    this.jobs.set(jobId, { status: 'PROCESSING', createdAt: new Date() });

    // Generate export synchronously and store result
    try {
      const result = await this.exportPatientUseCase.execute({
        patientId,
        organizationId: user.organizationId,
        userId: user.sub,
        includeDeleted: body.includeDeleted,
        sections: body.sections,
      });
      this.jobs.set(jobId, { status: 'COMPLETED', result, createdAt: new Date() });
    } catch (error) {
      this.jobs.set(jobId, { status: 'FAILED', result: { error: (error as Error).message }, createdAt: new Date() });
    }

    return {
      data: {
        jobId,
        message: 'Export generated successfully',
      },
    };
  }

  // GET /v1/export/jobs/:jobId — check job status
  @Get('v1/export/jobs/:jobId')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.EXPORT_PATIENT)
  async getExportJob(
    @Param('jobId') jobId: string,
    @CurrentUser() _user: JwtPayload,
  ) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new NotFoundException('Export job not found');
    }
    return {
      data: {
        jobId,
        status: job.status,
        result: job.status === 'COMPLETED' ? job.result : undefined,
      },
    };
  }

  // GET /v1/export/patients/:patientId — direct download
  @Get('v1/export/patients/:patientId')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.EXPORT_PATIENT)
  async exportPatientDirect(
    @Param('patientId') patientId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.exportPatientUseCase.execute({
        patientId,
        organizationId: user.organizationId,
        userId: user.sub,
      });
      return { data: result };
    } catch (error) {
      if (error instanceof PatientNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  // POST /v1/patients/:patientId/anonymize — irreversible anonymization
  @Post('v1/patients/:patientId/anonymize')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.ANONYMIZE_PATIENT)
  async anonymizePatient(
    @Param('patientId') patientId: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.anonymizePatientUseCase.execute({
        patientId,
        organizationId: user.organizationId,
        userId: user.sub,
        reason: body.reason,
      });
      return {
        data: {
          id: result.id,
          message: 'Patient anonymized successfully. This operation is IRREVERSIBLE — PII data cannot be recovered.',
        },
      };
    } catch (error) {
      if (error instanceof PatientNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
