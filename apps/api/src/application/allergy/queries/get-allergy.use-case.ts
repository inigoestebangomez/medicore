// apps/api/src/application/allergy/queries/get-allergy.use-case.ts
import type { IAllergyRepository } from '@/domain/allergy/allergy.repository.interface';

export interface GetAllergyQuery {
  patientId: string;
  organizationId: string;
}

export class GetAllergyUseCase {
  constructor(private readonly allergyRepo: IAllergyRepository) {}

  async execute(query: GetAllergyQuery) {
    const { patientId, organizationId } = query;
    return this.allergyRepo.findByPatientId(patientId, organizationId);
  }
}