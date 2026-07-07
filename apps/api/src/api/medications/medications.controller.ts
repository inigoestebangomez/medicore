// apps/api/src/api/medications/medications.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Headers,
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
import type { IMedicationRepository } from '@/domain/medication/medication.repository.interface';
import type { IAllergyRepository } from '@/domain/allergy/allergy.repository.interface';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import { Action } from '@/domain/shared/rbac-permissions';
import { CreatePrescriptionUseCase } from '@/application/medication/commands/create-prescription.use-case';
import { DiscontinueMedicationUseCase } from '@/application/medication/commands/discontinue-medication.use-case';
import { SoftDeleteMedicationUseCase } from '@/application/medication/commands/soft-delete-medication.use-case';
import { GetMedicationUseCase } from '@/application/medication/queries/get-medication.use-case';
import { ListMedicationsUseCase } from '@/application/medication/queries/list-medications.use-case';
import { MedicationNotFoundError } from '@/domain/medication/errors/medication-not-found.error';
import { InvalidMedicationTransitionError } from '@/domain/medication/errors/invalid-medication-transition.error';
import { AllergyConflictCriticalError } from '@/domain/medication/errors/allergy-conflict-critical.error';
import { MissingDiscontinuationReasonError } from '@/domain/medication/errors/missing-discontinuation-reason.error';
import { PatientNotActiveError } from '@/domain/consultation/errors/patient-not-active.error';
import {
  CreatePrescriptionSchema,
  DiscontinuePrescriptionSchema,
  ListMedicationsQuerySchema,
} from '@medicore/contracts';
import { ZodValidationPipe } from '@/api/shared/pipes/zod-validation.pipe';

@Controller('patients/:patientId/medications')
@UseGuards(AuthGuard, RBACGuard)
export class MedicationsController {
  private readonly createPrescriptionUseCase: CreatePrescriptionUseCase;
  private readonly discontinueMedicationUseCase: DiscontinueMedicationUseCase;
  private readonly softDeleteMedicationUseCase: SoftDeleteMedicationUseCase;
  private readonly getMedicationUseCase: GetMedicationUseCase;
  private readonly listMedicationsUseCase: ListMedicationsUseCase;

  constructor(
    @Inject('IMedicationRepository') medicationRepo: IMedicationRepository,
    @Inject('IAllergyRepository') allergyRepo: IAllergyRepository,
    @Inject('IPatientRepository') patientRepo: IPatientRepository,
  ) {
    this.createPrescriptionUseCase = new CreatePrescriptionUseCase(medicationRepo, allergyRepo, patientRepo);
    this.discontinueMedicationUseCase = new DiscontinueMedicationUseCase(medicationRepo);
    this.softDeleteMedicationUseCase = new SoftDeleteMedicationUseCase(medicationRepo);
    this.getMedicationUseCase = new GetMedicationUseCase(medicationRepo);
    this.listMedicationsUseCase = new ListMedicationsUseCase(medicationRepo);
  }

  @Post()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.CREATE_MEDICATION)
  async create(
    @Param('patientId') patientId: string,
    @Body(new ZodValidationPipe(CreatePrescriptionSchema)) body: any,
    @Headers('x-override-critical-allergy') overrideHeader: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.createPrescriptionUseCase.execute({
        organizationId: user.organizationId,
        patientId,
        drugName: body.drugName,
        drugCode: body.drugCode,
        activeIngredient: body.activeIngredient,
        dosage: body.dosage,
        frequency: body.frequency,
        route: body.route,
        form: body.form,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        duration: body.duration,
        instructions: body.instructions,
        reason: body.reason,
        consultationId: body.consultationId,
        physicianId: user.sub,
        createdBy: user.sub,
        overrideCriticalAllergy: overrideHeader === 'confirmed',
      });

      return {
        ...this.toResponse(result.medication),
        ...(result.allergyWarning ? { allergyWarning: result.allergyWarning } : {}),
        ...(result.duplicationWarning ? { duplicationWarning: result.duplicationWarning } : {}),
      };
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  @Get()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_MEDICATION)
  async list(
    @Param('patientId') patientId: string,
    @Query() query: any,
    @CurrentUser() user: JwtPayload,
  ) {
    const parsed = ListMedicationsQuerySchema.parse(query);

    const result = await this.listMedicationsUseCase.execute({
      patientId,
      organizationId: user.organizationId,
      page: parsed.page,
      pageSize: parsed.pageSize,
      status: parsed.status,
    });

    return {
      items: result.items.map(m => this.toResponse(m)),
      total: result.total,
      page: parsed.page,
      pageSize: parsed.pageSize,
    };
  }

  @Get(':medicationId')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_MEDICATION)
  async get(
    @Param('patientId') _patientId: string,
    @Param('medicationId') medicationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.getMedicationUseCase.execute({
        id: medicationId,
        organizationId: user.organizationId,
      });
      return this.toResponse(result);
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  @Patch(':medicationId/discontinue')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.DISCONTINUE_MEDICATION)
  async discontinue(
    @Param('patientId') _patientId: string,
    @Param('medicationId') medicationId: string,
    @Body(new ZodValidationPipe(DiscontinuePrescriptionSchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.discontinueMedicationUseCase.execute({
        id: medicationId,
        organizationId: user.organizationId,
        discontinuationReason: body.discontinuationReason,
        userId: user.sub,
      });
      return this.toResponse(result);
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  @Delete(':medicationId')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.DISCONTINUE_MEDICATION)
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('patientId') _patientId: string,
    @Param('medicationId') medicationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.softDeleteMedicationUseCase.execute({
        id: medicationId,
        organizationId: user.organizationId,
        userId: user.sub,
      });
      return this.toResponse(result);
    } catch (error) {
      this.mapDomainError(error);
    }
  }

  private toResponse(medication: any) {
    return {
      id: medication.id,
      patientId: medication.patientId,
      organizationId: medication.organizationId,
      consultationId: medication.consultationId,
      physicianId: medication.physicianId,
      drugName: medication.drugName,
      drugCode: medication.drugCode,
      activeIngredient: medication.activeIngredient,
      dosage: medication.dosage,
      frequency: medication.frequency,
      route: medication.route,
      form: medication.form,
      startDate: medication.startDate instanceof Date ? medication.startDate.toISOString() : medication.startDate,
      endDate: medication.endDate ? (medication.endDate instanceof Date ? medication.endDate.toISOString() : medication.endDate) : null,
      duration: medication.duration,
      status: medication.status,
      instructions: medication.instructions,
      reason: medication.reason,
      discontinuationReason: medication.discontinuationReason,
      createdBy: medication.createdBy,
      updatedBy: medication.updatedBy,
      createdAt: medication.createdAt instanceof Date ? medication.createdAt.toISOString() : medication.createdAt,
      updatedAt: medication.updatedAt instanceof Date ? medication.updatedAt.toISOString() : medication.updatedAt,
    };
  }

  private mapDomainError(error: unknown): never {
    if (error instanceof MedicationNotFoundError) {
      throw new NotFoundException(error.message);
    }
    if (error instanceof PatientNotActiveError) {
      throw new UnprocessableEntityException(error.message);
    }
    if (error instanceof InvalidMedicationTransitionError) {
      throw new UnprocessableEntityException({
        message: error.message,
        fromStatus: error.fromStatus,
        toStatus: error.toStatus,
      });
    }
    if (error instanceof AllergyConflictCriticalError) {
      throw new UnprocessableEntityException({
        message: error.message,
        code: error.code,
        substance: error.substance,
      });
    }
    if (error instanceof MissingDiscontinuationReasonError) {
      throw new UnprocessableEntityException({
        message: error.message,
        code: error.code,
      });
    }
    throw error;
  }
}