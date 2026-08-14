// apps/api/src/api/patients/patients.controller.ts
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
  ConflictException,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import type { JwtPayload } from '@medicore/contracts';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import type { IAllergyRepository } from '@/domain/allergy/allergy.repository.interface';
import { Action } from '@/domain/shared/rbac-permissions';
import { CreatePatientUseCase } from '@/application/patient/commands/create-patient.use-case';
import { UpdatePatientUseCase } from '@/application/patient/commands/update-patient.use-case';
import { SoftDeletePatientUseCase } from '@/application/patient/commands/soft-delete-patient.use-case';
import { GetPatientUseCase } from '@/application/patient/queries/get-patient.use-case';
import { ListPatientsUseCase } from '@/application/patient/queries/list-patients.use-case';
import { SearchPatientsUseCase } from '@/application/patient/queries/search-patients.use-case';
import { CreateAllergyUseCase } from '@/application/allergy/commands/create-allergy.use-case';
import { GetAllergyUseCase } from '@/application/allergy/queries/get-allergy.use-case';
import { UpdateAllergyUseCase } from '@/application/allergy/commands/update-allergy.use-case';
import { SoftDeleteAllergyUseCase } from '@/application/allergy/commands/soft-delete-allergy.use-case';
import { DuplicatePatientError } from '@/domain/patient/errors/duplicate-patient.error';
import { DuplicateNhcError } from '@/domain/patient/errors/duplicate-nhc.error';
import { PatientNotFoundError } from '@/domain/patient/errors/patient-not-found.error';
import { ScheduledSurgeryBlocksDeleteError } from '@/domain/patient/errors/scheduled-surgery-blocks-delete.error';
import {
  CreatePatientSchema,
  UpdatePatientSchema,
  CreateAllergySchema,
  UpdateAllergySchema,
  SearchPatientsSchema,
  PaginationSchema,
} from '@medicore/contracts';
import { ZodValidationPipe } from '@/api/shared/pipes/zod-validation.pipe';
import { ImportedClinicalEventProjector } from '@/application/patient/services/imported-clinical-event-projector';
import { InvalidImportedEventsCursorError, ListImportedClinicalEventsUseCase } from '@/application/patient/queries/list-imported-clinical-events.use-case';

@Controller('patients')
@UseGuards(AuthGuard, RBACGuard)
export class PatientsController {
  private readonly createPatientUseCase: CreatePatientUseCase;
  private readonly updatePatientUseCase: UpdatePatientUseCase;
  private readonly softDeletePatientUseCase: SoftDeletePatientUseCase;
  private readonly getPatientUseCase: GetPatientUseCase;
  private readonly listPatientsUseCase: ListPatientsUseCase;
  private readonly searchPatientsUseCase: SearchPatientsUseCase;
  private readonly createAllergyUseCase: CreateAllergyUseCase;
  private readonly getAllergyUseCase: GetAllergyUseCase;
  private readonly updateAllergyUseCase: UpdateAllergyUseCase;
  private readonly softDeleteAllergyUseCase: SoftDeleteAllergyUseCase;
  private readonly listImportedClinicalEventsUseCase: ListImportedClinicalEventsUseCase;

  // Repositories injected for NestJS DI — used by use-case constructors
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(
    @Inject('IPatientRepository') patientRepo: IPatientRepository,
    @Inject('IAllergyRepository') allergyRepo: IAllergyRepository,
  ) {
    this.createPatientUseCase = new CreatePatientUseCase(patientRepo);
    this.updatePatientUseCase = new UpdatePatientUseCase(patientRepo);
    this.softDeletePatientUseCase = new SoftDeletePatientUseCase(patientRepo);
    this.getPatientUseCase = new GetPatientUseCase(patientRepo);
    this.listPatientsUseCase = new ListPatientsUseCase(patientRepo);
    this.searchPatientsUseCase = new SearchPatientsUseCase(patientRepo);
    this.createAllergyUseCase = new CreateAllergyUseCase(allergyRepo, patientRepo);
    this.getAllergyUseCase = new GetAllergyUseCase(allergyRepo);
    this.updateAllergyUseCase = new UpdateAllergyUseCase(allergyRepo);
    this.softDeleteAllergyUseCase = new SoftDeleteAllergyUseCase(allergyRepo);
    this.listImportedClinicalEventsUseCase = new ListImportedClinicalEventsUseCase(
      patientRepo,
      new ImportedClinicalEventProjector(),
    );
  }

  @Post()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.CREATE_PATIENT)
  async create(
    @Body(new ZodValidationPipe(CreatePatientSchema)) body: any,
    @Headers('x-confirm-duplicate') confirmDuplicate: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.createPatientUseCase.execute({
        ...body,
        birthDate: body.birthDate, // Zod validates as string, use-case converts
        organizationId: user.organizationId,
        createdBy: user.sub,
        confirmDuplicate: confirmDuplicate === 'true',
      });
      return this.toResponse(result);
    } catch (error) {
      if (error instanceof DuplicatePatientError) {
        throw new ConflictException({
          message: 'Duplicate patient detected',
          similarPatients: error.similarPatients,
          confirmRequired: error.confirmationRequired,
        });
      }
      if (error instanceof DuplicateNhcError) {
        throw new ConflictException({ message: error.message });
      }
      throw error;
    }
  }

  @Get()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async list(
    @Query() query: any,
    @CurrentUser() user: JwtPayload,
  ) {
    const pagination = PaginationSchema.parse(query);
    const result = await this.listPatientsUseCase.execute({
      organizationId: user.organizationId,
      role: user.role,
      page: pagination.page,
      pageSize: pagination.pageSize,
      sortBy: query.sortBy ?? 'lastName',
      sortOrder: query.sortOrder ?? 'asc',
    });
    return result;
  }

  @Get('search')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async search(
    @Query(new ZodValidationPipe(SearchPatientsSchema)) query: any,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.searchPatientsUseCase.execute({
      organizationId: user.organizationId,
      role: user.role,
      query: query.query,
      page: query.page,
      pageSize: query.pageSize,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
    return result;
  }

  @Get(':patientId/imported-events')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async listImportedEvents(
    @Param('patientId') patientId: string,
    @Query('pageSize') pageSize: string | undefined,
    @Query('cursor') cursor: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      return await this.listImportedClinicalEventsUseCase.execute({
        patientId,
        organizationId: user.organizationId,
        pageSize: pageSize === undefined ? undefined : Number(pageSize),
        cursor,
      });
    } catch (error) {
      if (error instanceof InvalidImportedEventsCursorError || (error instanceof Error && error.message.startsWith('pageSize'))) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof Error && error.message === 'Patient not found') {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  @Get(':id')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async get(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    try {
      const result = await this.getPatientUseCase.execute({
        id,
        organizationId: user.organizationId,
        role: user.role,
      });
      return result;
    } catch (error) {
      if (error instanceof PatientNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  @Patch(':id')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.UPDATE_PATIENT)
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePatientSchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.updatePatientUseCase.execute({
        id,
        organizationId: user.organizationId,
        ...body,
        birthDate: body.birthDate,
        updatedBy: user.sub,
      });
      return this.toResponse(result);
    } catch (error) {
      if (error instanceof PatientNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  @Delete(':id')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.DELETE_PATIENT)
  async remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    try {
      const result = await this.softDeletePatientUseCase.execute({
        id,
        organizationId: user.organizationId,
      });
      return this.toResponse(result);
    } catch (error) {
      if (error instanceof PatientNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof ScheduledSurgeryBlocksDeleteError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  @Post(':patientId/allergies')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.UPDATE_PATIENT)
  async createAllergy(
    @Param('patientId') patientId: string,
    @Body(new ZodValidationPipe(CreateAllergySchema)) body: any,
    @Headers('x-confirm-anaphylaxis') confirmAnaphylaxis: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.createAllergyUseCase.execute({
        ...body,
        patientId,
        organizationId: user.organizationId,
        createdBy: user.sub,
        onsetDate: body.onsetDate,
        confirmAnaphylaxis: confirmAnaphylaxis === 'true',
      });
      return this.toAllergyResponse(result);
    } catch (error: unknown) {
      if (error instanceof PatientNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof Error && error.message === 'ANAPHYLAXIS allergy requires explicit confirmation') {
        throw new ConflictException({
          message: 'ANAPHYLAXIS allergy requires explicit confirmation via X-Confirm-Anaphylaxis header',
        });
      }
      throw error;
    }
  }

  @Get(':patientId/allergies')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async listAllergies(@Param('patientId') patientId: string, @CurrentUser() user: JwtPayload) {
    const result = await this.getAllergyUseCase.execute({
      patientId,
      organizationId: user.organizationId,
    });
    return result.map((a) => this.toAllergyResponse(a));
  }

  @Patch(':patientId/allergies/:allergyId')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.UPDATE_PATIENT)
  async updateAllergy(
    @Param('patientId') _patientId: string,
    @Param('allergyId') allergyId: string,
    @Body(new ZodValidationPipe(UpdateAllergySchema)) body: any,
    @Headers('x-confirm-anaphylaxis') confirmAnaphylaxis: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.updateAllergyUseCase.execute({
        id: allergyId,
        organizationId: user.organizationId,
        ...body,
        onsetDate: body.onsetDate,
        confirmAnaphylaxis: confirmAnaphylaxis === 'true',
      });
      return this.toAllergyResponse(result);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Allergy not found') {
        throw new NotFoundException('Allergy not found');
      }
      if (error instanceof Error && error.message === 'ANAPHYLAXIS allergy requires explicit confirmation') {
        throw new ConflictException({
          message: 'ANAPHYLAXIS allergy requires explicit confirmation via X-Confirm-Anaphylaxis header',
        });
      }
      throw error;
    }
  }

  @Delete(':patientId/allergies/:allergyId')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.UPDATE_PATIENT)
  async deleteAllergy(
    @Param('patientId') _patientId: string,
    @Param('allergyId') allergyId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.softDeleteAllergyUseCase.execute({
        id: allergyId,
        organizationId: user.organizationId,
      });
      return this.toAllergyResponse(result);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Allergy not found') {
        throw new NotFoundException('Allergy not found');
      }
      throw error;
    }
  }

  private toResponse(patient: any) {
    return {
      id: patient.id,
      nhc: patient.nhc,
      firstName: patient.firstName,
      lastName: patient.lastName,
      birthDate: patient.birthDate instanceof Date ? patient.birthDate.toISOString() : patient.birthDate,
      sex: patient.sex,
      phone: patient.phone,
      email: patient.email,
      address: patient.address,
      idDocument: patient.idDocument,
      idDocType: patient.idDocType,
      bloodType: patient.bloodType,
      notes: patient.notes,
      emergencyContact: patient.emergencyContact,
      deletedAt: patient.deletedAt ? (patient.deletedAt instanceof Date ? patient.deletedAt.toISOString() : patient.deletedAt) : null,
      createdBy: patient.createdBy,
      createdAt: patient.createdAt instanceof Date ? patient.createdAt.toISOString() : patient.createdAt,
      updatedAt: patient.updatedAt instanceof Date ? patient.updatedAt.toISOString() : patient.updatedAt,
    };
  }

  private toAllergyResponse(allergy: any) {
    return {
      id: allergy.id,
      patientId: allergy.patientId,
      substance: allergy.substance,
      substanceCode: allergy.substanceCode,
      reaction: allergy.reaction,
      severity: allergy.severity,
      status: allergy.status,
      onsetDate: allergy.onsetDate instanceof Date ? allergy.onsetDate?.toISOString() : allergy.onsetDate,
      notes: allergy.notes,
      createdAt: allergy.createdAt instanceof Date ? allergy.createdAt.toISOString() : allergy.createdAt,
      updatedAt: allergy.updatedAt instanceof Date ? allergy.updatedAt.toISOString() : allergy.updatedAt,
      deletedAt: allergy.deletedAt ? (allergy.deletedAt instanceof Date ? allergy.deletedAt.toISOString() : allergy.deletedAt) : null,
    };
  }
}
