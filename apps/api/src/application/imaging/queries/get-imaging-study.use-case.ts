// apps/api/src/application/imaging/queries/get-imaging-study.use-case.ts

import type { IImagingStudyRepository } from '@/domain/imaging/imaging-study.repository.interface';
import type { ImagingStudy } from '@/domain/imaging/imaging-study.entity';
import { ImagingStudyNotFoundError } from '@/domain/imaging/errors/imaging-study-not-found.error';

export interface GetImagingStudyQuery {
  id: string;
  organizationId: string;
}

export class GetImagingStudyUseCase {
  constructor(private readonly imagingRepo: IImagingStudyRepository) {}

  async execute(query: GetImagingStudyQuery): Promise<ImagingStudy> {
    const { id, organizationId } = query;

    const study = await this.imagingRepo.findById(id, organizationId);
    if (!study) {
      throw new ImagingStudyNotFoundError(id);
    }

    return study;
  }
}