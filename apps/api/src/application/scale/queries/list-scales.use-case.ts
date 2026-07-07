// apps/api/src/application/scale/queries/list-scales.use-case.ts
// BR-SCA-003: Chronological ordering by date descending

import type { IClinicalScaleRepository, ListScalesParams } from '@/domain/scale/scale.repository.interface';
import type { ClinicalScaleType } from '@medicore/contracts';

export interface ListScalesCommand {
  patientId: string;
  organizationId: string;
  page: number;
  pageSize: number;
  scaleType?: ClinicalScaleType;
  from?: Date;
  to?: Date;
}

export class ListScalesUseCase {
  constructor(
    private readonly scaleRepo: IClinicalScaleRepository,
  ) {}

  async execute(command: ListScalesCommand) {
    const params: ListScalesParams = {
      patientId: command.patientId,
      organizationId: command.organizationId,
      page: command.page,
      pageSize: command.pageSize,
      scaleType: command.scaleType,
      from: command.from,
      to: command.to,
    };

    return this.scaleRepo.listByPatient(params);
  }
}