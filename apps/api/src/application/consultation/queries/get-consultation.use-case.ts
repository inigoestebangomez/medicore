// apps/api/src/application/consultation/queries/get-consultation.use-case.ts

import type { IConsultationRepository } from '@/domain/consultation/consultation.repository.interface';
import type { Consultation } from '@/domain/consultation/consultation.entity';
import { ConsultationNotFoundError } from '@/domain/consultation/errors/consultation-not-found.error';

export interface GetConsultationQuery {
  id: string;
  organizationId: string;
}

export class GetConsultationUseCase {
  constructor(private readonly consultationRepo: IConsultationRepository) {}

  async execute(query: GetConsultationQuery): Promise<Consultation> {
    const { id, organizationId } = query;

    const consultation = await this.consultationRepo.findById(id, organizationId);
    if (!consultation) {
      throw new ConsultationNotFoundError(id);
    }

    return consultation;
  }
}
