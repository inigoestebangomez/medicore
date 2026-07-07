// apps/api/src/application/medication/queries/get-medication.use-case.ts

import type { IMedicationRepository } from '@/domain/medication/medication.repository.interface';
import { MedicationNotFoundError } from '@/domain/medication/errors/medication-not-found.error';

export interface GetMedicationCommand {
  id: string;
  organizationId: string;
}

export class GetMedicationUseCase {
  constructor(
    private readonly medicationRepo: IMedicationRepository,
  ) {}

  async execute(command: GetMedicationCommand) {
    const medication = await this.medicationRepo.findById(command.id, command.organizationId);
    if (!medication) {
      throw new MedicationNotFoundError(command.id);
    }
    return medication;
  }
}