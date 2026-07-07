// apps/api/src/application/scale/commands/create-clinical-scale.use-case.ts
// BR-SCA-001: Validate scores against per-scale type Zod schema
// BR-SCA-002: Server-side total recalculation — ignore client-sent total

import type { IClinicalScaleRepository, CreateClinicalScaleInput } from '@/domain/scale/scale.repository.interface';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import type { ClinicalScale } from '@/domain/scale/clinical-scale.entity';
import type { ClinicalScaleType } from '@medicore/contracts';
import { ScaleTypeValidationMap } from '@medicore/contracts';
import { InvalidScaleScoresError } from '@/domain/scale/errors/invalid-scale-scores.error';
import { InvalidScaleTypeError } from '@/domain/scale/errors/invalid-scale-type.error';
import { PatientNotActiveError } from '@/domain/consultation/errors/patient-not-active.error';
import { calculateTotal } from '@/domain/scale/value-objects/scale-calculator';

export interface CreateClinicalScaleCommand {
  organizationId: string;
  patientId: string;
  consultationId?: string;
  scaleType: ClinicalScaleType;
  date?: Date;
  scores: Record<string, number>;
  notes?: string;
  createdBy: string;
}

export class CreateClinicalScaleUseCase {
  constructor(
    private readonly scaleRepo: IClinicalScaleRepository,
    private readonly patientRepo: IPatientRepository,
  ) {}

  async execute(command: CreateClinicalScaleCommand): Promise<ClinicalScale> {
    // Verify patient exists and is active
    const patient = await this.patientRepo.findById(command.patientId, command.organizationId);
    if (!patient) {
      throw new PatientNotActiveError(command.patientId);
    }

    // BR-SCA-001: Validate scores against per-scale type schema
    const schema = ScaleTypeValidationMap[command.scaleType];
    if (!schema) {
      throw new InvalidScaleTypeError(command.scaleType);
    }

    const validationResult = schema.safeParse(command.scores);
    if (!validationResult.success) {
      const message = validationResult.error.issues.map(i => i.message).join('; ');
      throw new InvalidScaleScoresError(command.scaleType, message);
    }

    // BR-SCA-002: Server-side total recalculation — never trust client total
    const total = calculateTotal(command.scaleType, command.scores);

    const data: CreateClinicalScaleInput = {
      organizationId: command.organizationId,
      patientId: command.patientId,
      consultationId: command.consultationId ?? null,
      scaleType: command.scaleType,
      date: command.date ?? new Date(),
      scores: command.scores,
      total,
      notes: command.notes ?? null,
      createdBy: command.createdBy,
    };

    return this.scaleRepo.create(data);
  }
}