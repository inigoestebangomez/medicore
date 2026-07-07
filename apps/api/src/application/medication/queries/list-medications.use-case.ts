// apps/api/src/application/medication/queries/list-medications.use-case.ts

import type { IMedicationRepository, ListMedicationsParams } from '@/domain/medication/medication.repository.interface';
import type { MedicationStatus } from '@medicore/contracts';

export interface ListMedicationsCommand {
  patientId: string;
  organizationId: string;
  page: number;
  pageSize: number;
  status?: MedicationStatus;
}

export class ListMedicationsUseCase {
  constructor(
    private readonly medicationRepo: IMedicationRepository,
  ) {}

  async execute(command: ListMedicationsCommand) {
    const params: ListMedicationsParams = {
      patientId: command.patientId,
      organizationId: command.organizationId,
      page: command.page,
      pageSize: command.pageSize,
      status: command.status,
    };

    return this.medicationRepo.listByPatient(params);
  }
}