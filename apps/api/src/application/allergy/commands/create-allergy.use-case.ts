// apps/api/src/application/allergy/commands/create-allergy.use-case.ts
// BR-PAT-006: ANAPHYLAXIS allergy requires explicit confirmation

import type { IAllergyRepository, CreateAllergyInput } from '@/domain/allergy/allergy.repository.interface';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import { PatientNotFoundError } from '@/domain/patient/errors/patient-not-found.error';

export interface CreateAllergyCommand {
  patientId: string;
  organizationId: string;
  substance: string;
  severity: string;
  status?: string;
  reaction?: string;
  substanceCode?: string;
  onsetDate?: string;
  notes?: string;
  createdBy: string;
  confirmAnaphylaxis?: boolean;
}

export class CreateAllergyUseCase {
  constructor(
    private readonly allergyRepo: IAllergyRepository,
    private readonly patientRepo: IPatientRepository,
  ) {}

  async execute(command: CreateAllergyCommand) {
    const { patientId, organizationId, createdBy } = command;

    // Verify patient exists
    const patient = await this.patientRepo.findById(patientId, organizationId);
    if (!patient) {
      throw new PatientNotFoundError(patientId);
    }

    // BR-PAT-006: ANAPHYLAXIS allergy requires explicit confirmation
    if (command.severity === 'ANAPHYLAXIS' && !command.confirmAnaphylaxis) {
      throw new Error('ANAPHYLAXIS allergy requires explicit confirmation');
    }

    const data: CreateAllergyInput = {
      patientId,
      organizationId,
      substance: command.substance,
      severity: command.severity,
      status: command.status ?? 'ACTIVE',
      reaction: command.reaction ?? null,
      substanceCode: command.substanceCode ?? null,
      onsetDate: command.onsetDate ? new Date(command.onsetDate) : null,
      notes: command.notes ?? null,
      createdBy,
    };

    return this.allergyRepo.create(data);
  }
}