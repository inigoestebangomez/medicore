// apps/api/src/application/patient/commands/soft-delete-patient.use-case.ts
// BR-PAT-005: Soft-delete blocked if patient has SCHEDULED surgeries

import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import { PatientNotFoundError } from '@/domain/patient/errors/patient-not-found.error';
import { ScheduledSurgeryBlocksDeleteError } from '@/domain/patient/errors/scheduled-surgery-blocks-delete.error';

export interface SoftDeletePatientCommand {
  id: string;
  organizationId: string;
}

export class SoftDeletePatientUseCase {
  constructor(private readonly patientRepo: IPatientRepository) {}

  async execute(command: SoftDeletePatientCommand) {
    const { id, organizationId } = command;

    // Verify patient exists
    const patient = await this.patientRepo.findById(id, organizationId);
    if (!patient) {
      throw new PatientNotFoundError(id);
    }

    // BR-PAT-005: Block deletion if patient has scheduled surgeries
    const hasSurgeries = await this.patientRepo.hasScheduledSurgeries(id, organizationId);
    if (hasSurgeries) {
      throw new ScheduledSurgeryBlocksDeleteError(id);
    }

    return this.patientRepo.softDelete(id, organizationId);
  }
}