// apps/api/src/application/scale/queries/get-scale.use-case.ts

import type { IClinicalScaleRepository } from '@/domain/scale/scale.repository.interface';
import { ClinicalScaleNotFoundError } from '@/domain/scale/errors/clinical-scale-not-found.error';

export interface GetScaleCommand {
  id: string;
  organizationId: string;
}

export class GetScaleUseCase {
  constructor(
    private readonly scaleRepo: IClinicalScaleRepository,
  ) {}

  async execute(command: GetScaleCommand) {
    const scale = await this.scaleRepo.findById(command.id, command.organizationId);
    if (!scale) {
      throw new ClinicalScaleNotFoundError(command.id);
    }
    return scale;
  }
}