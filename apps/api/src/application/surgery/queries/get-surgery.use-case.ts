// apps/api/src/application/surgery/queries/get-surgery.use-case.ts

import type { ISurgeryRepository } from '@/domain/surgery/surgery.repository.interface';
import type { Surgery } from '@/domain/surgery/surgery.entity';
import { SurgeryNotFoundError } from '@/domain/surgery/errors/surgery-not-found.error';

export interface GetSurgeryQuery {
  id: string;
  organizationId: string;
}

export class GetSurgeryUseCase {
  constructor(private readonly surgeryRepo: ISurgeryRepository) {}

  async execute(query: GetSurgeryQuery): Promise<Surgery> {
    const { id, organizationId } = query;

    const surgery = await this.surgeryRepo.findById(id, organizationId);
    if (!surgery) {
      throw new SurgeryNotFoundError(id);
    }

    return surgery;
  }
}