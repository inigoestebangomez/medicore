// apps/api/src/application/medication/commands/soft-delete-medication.use-case.ts

import type { IMedicationRepository } from '@/domain/medication/medication.repository.interface';
import type { Medication } from '@/domain/medication/medication.entity';
import { MedicationNotFoundError } from '@/domain/medication/errors/medication-not-found.error';

export interface SoftDeleteMedicationCommand {
  id: string;
  organizationId: string;
  userId: string;
}

export class SoftDeleteMedicationUseCase {
  constructor(
    private readonly medicationRepo: IMedicationRepository,
  ) {}

  async execute(command: SoftDeleteMedicationCommand): Promise<Medication> {
    const medication = await this.medicationRepo.findById(command.id, command.organizationId);
    if (!medication) {
      throw new MedicationNotFoundError(command.id);
    }

    return this.medicationRepo.softDelete(command.id, command.organizationId);
  }
}