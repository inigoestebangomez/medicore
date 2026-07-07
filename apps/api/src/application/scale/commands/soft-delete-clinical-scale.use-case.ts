// apps/api/src/application/scale/commands/soft-delete-clinical-scale.use-case.ts

import type { IClinicalScaleRepository } from '@/domain/scale/scale.repository.interface';
import type { ClinicalScale } from '@/domain/scale/clinical-scale.entity';
import { ClinicalScaleNotFoundError } from '@/domain/scale/errors/clinical-scale-not-found.error';

export interface SoftDeleteClinicalScaleCommand {
  id: string;
  organizationId: string;
  userId: string;
}

export class SoftDeleteClinicalScaleUseCase {
  constructor(
    private readonly scaleRepo: IClinicalScaleRepository,
  ) {}

  async execute(command: SoftDeleteClinicalScaleCommand): Promise<ClinicalScale> {
    const scale = await this.scaleRepo.findById(command.id, command.organizationId);
    if (!scale) {
      throw new ClinicalScaleNotFoundError(command.id);
    }

    return this.scaleRepo.softDelete(command.id, command.organizationId);
  }
}