// apps/api/src/application/allergy/commands/soft-delete-allergy.use-case.ts

import type { IAllergyRepository } from '@/domain/allergy/allergy.repository.interface';

export interface SoftDeleteAllergyCommand {
  id: string;
  organizationId: string;
}

export class SoftDeleteAllergyUseCase {
  constructor(private readonly allergyRepo: IAllergyRepository) {}

  async execute(command: SoftDeleteAllergyCommand) {
    const { id, organizationId } = command;

    const existing = await this.allergyRepo.findById(id, organizationId);
    if (!existing) {
      throw new Error('Allergy not found');
    }

    return this.allergyRepo.softDelete(id, organizationId);
  }
}
