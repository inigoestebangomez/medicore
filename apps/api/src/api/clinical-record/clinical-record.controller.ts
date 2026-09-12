// apps/api/src/api/clinical-record/clinical-record.controller.ts
// API layer for the seven clinical categories (spec §1–§7).
// GET /v1/patients/:patientId/clinical-record?category=...
// POST commands for history, illness, exams, lab review, diagnoses.

import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Inject,
  UseGuards,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  ClinicalRecordCategorySchema,
  CreateHistoryEntrySchema,
  CreateCurrentIllnessSchema,
  CreatePhysicalExamRecordSchema,
  ConfirmLabResultsSchema,
  CreateDiagnosisSchema,
  UpdateDiagnosisStatusSchema,
} from '@medicore/contracts';
import type { JwtPayload } from '@medicore/contracts';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard, REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import { Action } from '@/domain/shared/rbac-permissions';
import { ZodValidationPipe } from '@/api/shared/pipes/zod-validation.pipe';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';

import { GetClinicalRecordUseCase, PatientNotFoundError } from '@/application/clinical-record/queries/get-clinical-record.use-case';
import { CreateHistoryEntryUseCase } from '@/application/clinical-record/commands/create-history-entry.use-case';
import { CreateCurrentIllnessUseCase } from '@/application/clinical-record/commands/create-current-illness.use-case';
import { CreateExamRecordUseCase } from '@/application/clinical-record/commands/create-exam-record.use-case';
import { ConfirmLabResultsUseCase } from '@/application/clinical-record/commands/confirm-lab-results.use-case';
import { CreateDiagnosisUseCase, InvalidDiagnosisCodeError } from '@/application/clinical-record/commands/create-diagnosis.use-case';
import { UpdateDiagnosisStatusUseCase } from '@/application/clinical-record/commands/update-diagnosis-status.use-case';

import type { IHistoryRepository } from '@/domain/clinical-record/history/history.repository.interface';
import type { ICurrentIllnessRepository } from '@/domain/clinical-record/current-illness/current-illness.repository.interface';
import type { IPhysicalExamRepository } from '@/domain/clinical-record/physical-exam/physical-exam.repository.interface';
import type { ILabReportRepository } from '@/domain/clinical-record/lab/lab-report.repository.interface';
import type { IDiagnosisRepository } from '@/domain/clinical-record/diagnosis/diagnosis.repository.interface';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import type { ISurgeryRepository } from '@/domain/surgery/surgery.repository.interface';
import type { IMedicationRepository } from '@/domain/medication/medication.repository.interface';

@Controller('v1/patients/:patientId/clinical-record')
@UseGuards(AuthGuard, RBACGuard)
export class ClinicalRecordController {
  private readonly getClinicalRecordUseCase: GetClinicalRecordUseCase;
  private readonly createHistoryEntryUseCase: CreateHistoryEntryUseCase;
  private readonly createCurrentIllnessUseCase: CreateCurrentIllnessUseCase;
  private readonly createExamRecordUseCase: CreateExamRecordUseCase;
  private readonly confirmLabResultsUseCase: ConfirmLabResultsUseCase;
  private readonly createDiagnosisUseCase: CreateDiagnosisUseCase;
  private readonly updateDiagnosisStatusUseCase: UpdateDiagnosisStatusUseCase;

  constructor(
    @Inject('IPatientRepository') patientRepo: IPatientRepository,
    @Inject('IHistoryRepository') historyRepo: IHistoryRepository,
    @Inject('ICurrentIllnessRepository') illnessRepo: ICurrentIllnessRepository,
    @Inject('IPhysicalExamRepository') examRepo: IPhysicalExamRepository,
    @Inject('ILabReportRepository') labRepo: ILabReportRepository,
    @Inject('IDiagnosisRepository') diagnosisRepo: IDiagnosisRepository,
    @Inject('ISurgeryRepository') surgeryRepo: ISurgeryRepository,
    @Inject('IMedicationRepository') medicationRepo: IMedicationRepository,
  ) {
    this.getClinicalRecordUseCase = new GetClinicalRecordUseCase(
      patientRepo, historyRepo, illnessRepo, examRepo, labRepo, diagnosisRepo, surgeryRepo, medicationRepo,
    );
    this.createHistoryEntryUseCase = new CreateHistoryEntryUseCase(historyRepo);
    this.createCurrentIllnessUseCase = new CreateCurrentIllnessUseCase(illnessRepo);
    this.createExamRecordUseCase = new CreateExamRecordUseCase(examRepo);
    this.confirmLabResultsUseCase = new ConfirmLabResultsUseCase(labRepo);
    this.createDiagnosisUseCase = new CreateDiagnosisUseCase(diagnosisRepo);
    this.updateDiagnosisStatusUseCase = new UpdateDiagnosisStatusUseCase(diagnosisRepo);
  }

  @Get()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_CLINICAL_RECORD)
  async getClinicalRecord(
    @Param('patientId') patientId: string,
    @Query('category') category: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const parsed = ClinicalRecordCategorySchema.safeParse(category);
    if (!parsed.success) {
      throw new BadRequestException(`Invalid category: ${category}`);
    }

    try {
      return await this.getClinicalRecordUseCase.execute({
        organizationId: user.organizationId,
        patientId,
        category: parsed.data,
      });
    } catch (error) {
      if (error instanceof PatientNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  @Post('history')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.CREATE_CLINICAL_RECORD)
  async createHistoryEntry(
    @Param('patientId') patientId: string,
    @Body(new ZodValidationPipe(CreateHistoryEntrySchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    const entry = await this.createHistoryEntryUseCase.execute({
      organizationId: user.organizationId,
      patientId,
      entryType: body.entryType,
      key: body.key,
      value: body.value,
      sourceType: body.provenance.sourceType,
      sourceId: body.provenance.sourceId ?? null,
      authorId: body.provenance.authorId,
    });
    return this.toHistoryResponse(entry);
  }

  @Post('current-illness')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.CREATE_CLINICAL_RECORD)
  async createCurrentIllness(
    @Param('patientId') patientId: string,
    @Body(new ZodValidationPipe(CreateCurrentIllnessSchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    const entry = await this.createCurrentIllnessUseCase.execute({
      organizationId: user.organizationId,
      patientId,
      symptoms: body.symptoms,
      durationValue: body.durationValue,
      durationUnit: body.durationUnit,
      onset: body.onset ? new Date(body.onset) : null,
      evolution: body.evolution,
      narrative: body.narrative,
      consultationId: body.consultationId,
      sourceType: body.provenance.sourceType,
      authorId: body.provenance.authorId,
    });
    return this.toIllnessResponse(entry);
  }

  @Post('physical-exam')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.CREATE_CLINICAL_RECORD)
  async createExamRecord(
    @Param('patientId') patientId: string,
    @Body(new ZodValidationPipe(CreatePhysicalExamRecordSchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const record = await this.createExamRecordUseCase.execute({
        organizationId: user.organizationId,
        patientId,
        templateId: body.templateId,
        values: body.values,
        customFindings: body.customFindings,
        consultationId: body.consultationId,
        sourceType: body.provenance.sourceType,
        authorId: body.provenance.authorId,
      });
      return this.toExamResponse(record);
    } catch (error) {
      if (error instanceof Error && error.message === 'Exam template not found') {
        throw new NotFoundException(error.message);
      }
      if (error instanceof Error && error.message.startsWith('Required field')) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Post('lab/confirm')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.REVIEW_CLINICAL_RECORD)
  async confirmLabResults(
    @Param('patientId') _patientId: string,
    @Body(new ZodValidationPipe(ConfirmLabResultsSchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const report = await this.confirmLabResultsUseCase.execute({
        organizationId: user.organizationId,
        reportId: body.reportId,
        results: body.results,
        reviewerId: body.reviewerId,
      });
      if (!report) {
        throw new NotFoundException('Lab report not found');
      }
      return this.toLabReportResponse(report);
    } catch (error) {
      if (error instanceof Error && error.message === 'Lab report not found') {
        throw new NotFoundException(error.message);
      }
      if (error instanceof Error && error.message.startsWith('Lab result at index')) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Post('diagnosis')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.CREATE_CLINICAL_RECORD)
  async createDiagnosis(
    @Param('patientId') patientId: string,
    @Body(new ZodValidationPipe(CreateDiagnosisSchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const diagnosis = await this.createDiagnosisUseCase.execute({
        organizationId: user.organizationId,
        patientId,
        system: body.system,
        code: body.code,
        description: body.description,
        catalogVersion: body.catalogVersion,
        status: body.status,
        variables: body.variables,
        consultationId: body.consultationId,
        sourceType: body.provenance.sourceType,
        authorId: body.provenance.authorId,
      });
      return this.toDiagnosisResponse(diagnosis);
    } catch (error) {
      if (error instanceof InvalidDiagnosisCodeError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Patch('diagnosis/:diagnosisId/status')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.REVIEW_CLINICAL_RECORD)
  async updateDiagnosisStatus(
    @Param('patientId') _patientId: string,
    @Param('diagnosisId') diagnosisId: string,
    @Body(new ZodValidationPipe(UpdateDiagnosisStatusSchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const diagnosis = await this.updateDiagnosisStatusUseCase.execute({
        organizationId: user.organizationId,
        diagnosisId,
        status: body.status,
        reviewerId: body.reviewerId,
      });
      return this.toDiagnosisResponse(diagnosis);
    } catch (error) {
      if (error instanceof Error && error.message === 'Diagnosis not found') {
        throw new NotFoundException(error.message);
      }
      if (error instanceof Error && error.message.startsWith('Cannot')) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  // ─────────────────────────────────────────────
  // Response mappers
  // ─────────────────────────────────────────────

  private toHistoryResponse(entry: any) {
    return {
      id: entry.id,
      patientId: entry.patientId,
      entryType: entry.entryType,
      key: entry.key,
      value: entry.value,
      provenance: {
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        authorId: entry.authorId,
        recordedAt: entry.recordedAt instanceof Date ? entry.recordedAt.toISOString() : entry.recordedAt,
        reviewState: entry.reviewState,
      },
      createdAt: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : entry.createdAt,
      updatedAt: entry.updatedAt instanceof Date ? entry.updatedAt.toISOString() : entry.updatedAt,
    };
  }

  private toIllnessResponse(entry: any) {
    return {
      id: entry.id,
      patientId: entry.patientId,
      symptoms: entry.symptoms,
      durationValue: entry.durationValue,
      durationUnit: entry.durationUnit,
      onset: entry.onset instanceof Date ? entry.onset.toISOString() : entry.onset,
      evolution: entry.evolution,
      narrative: entry.narrative,
      consultationId: entry.consultationId,
      provenance: {
        sourceType: entry.sourceType,
        authorId: entry.authorId,
        recordedAt: entry.recordedAt instanceof Date ? entry.recordedAt.toISOString() : entry.recordedAt,
        reviewState: entry.reviewState,
      },
      createdAt: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : entry.createdAt,
      updatedAt: entry.updatedAt instanceof Date ? entry.updatedAt.toISOString() : entry.updatedAt,
    };
  }

  private toExamResponse(record: any) {
    return {
      id: record.id,
      patientId: record.patientId,
      templateId: record.templateId,
      templateVersion: record.templateVersion,
      templateSchemaSnapshot: record.templateSchemaSnapshot,
      values: record.values,
      customFindings: record.customFindings,
      consultationId: record.consultationId,
      provenance: {
        sourceType: record.sourceType,
        authorId: record.authorId,
        recordedAt: record.recordedAt instanceof Date ? record.recordedAt.toISOString() : record.recordedAt,
        reviewState: record.reviewState,
      },
      createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
    };
  }

  private toLabReportResponse(report: any) {
    return {
      id: report.id,
      patientId: report.patientId,
      s3Key: report.s3Key,
      fileName: report.fileName,
      ocrPayload: report.ocrPayload,
      overallReviewState: report.overallReviewState,
      results: report.results.map((r: any) => ({
        id: r.id,
        index: r.index,
        name: r.name,
        value: r.value,
        unit: r.unit,
        referenceRange: r.referenceRange,
        reviewState: r.reviewState,
        reviewedBy: r.reviewedBy,
        reviewedAt: r.reviewedAt instanceof Date ? r.reviewedAt.toISOString() : r.reviewedAt,
      })),
      provenance: {
        sourceType: report.sourceType,
        authorId: report.authorId,
        recordedAt: report.recordedAt instanceof Date ? report.recordedAt.toISOString() : report.recordedAt,
        reviewState: report.overallReviewState,
      },
      createdAt: report.createdAt instanceof Date ? report.createdAt.toISOString() : report.createdAt,
      updatedAt: report.updatedAt instanceof Date ? report.updatedAt.toISOString() : report.updatedAt,
    };
  }

  private toDiagnosisResponse(diagnosis: any) {
    return {
      id: diagnosis.id,
      patientId: diagnosis.patientId,
      system: diagnosis.system,
      code: diagnosis.code,
      description: diagnosis.description,
      catalogVersion: diagnosis.catalogVersion,
      status: diagnosis.status,
      variables: diagnosis.variables,
      consultationId: diagnosis.consultationId,
      provenance: {
        sourceType: diagnosis.sourceType,
        authorId: diagnosis.authorId,
        recordedAt: diagnosis.recordedAt instanceof Date ? diagnosis.recordedAt.toISOString() : diagnosis.recordedAt,
        reviewState: diagnosis.status === 'ACTIVE' ? 'CONFIRMED' : 'UNREVIEWED',
      },
      createdAt: diagnosis.createdAt instanceof Date ? diagnosis.createdAt.toISOString() : diagnosis.createdAt,
      updatedAt: diagnosis.updatedAt instanceof Date ? diagnosis.updatedAt.toISOString() : diagnosis.updatedAt,
    };
  }
}
