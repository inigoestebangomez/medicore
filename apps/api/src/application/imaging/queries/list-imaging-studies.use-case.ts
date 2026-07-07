// apps/api/src/application/imaging/queries/list-imaging-studies.use-case.ts

import type { IImagingStudyRepository, ListImagingStudiesParams } from '@/domain/imaging/imaging-study.repository.interface';
import type { ImagingStudy } from '@/domain/imaging/imaging-study.entity';
import type { ImagingStudyType } from '@medicore/contracts';

export interface ListImagingStudiesQuery {
  patientId: string;
  organizationId: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'date' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  type?: ImagingStudyType;
  from?: Date;
  to?: Date;
}

export interface ListImagingStudiesResult {
  items: ImagingStudy[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListImagingStudiesUseCase {
  constructor(private readonly imagingRepo: IImagingStudyRepository) {}

  async execute(query: ListImagingStudiesQuery): Promise<ListImagingStudiesResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const params: ListImagingStudiesParams = {
      patientId: query.patientId,
      organizationId: query.organizationId,
      page,
      pageSize,
      sortBy: query.sortBy ?? 'date',
      sortOrder: query.sortOrder ?? 'desc',
      type: query.type,
      from: query.from,
      to: query.to,
    };

    const { items, total } = await this.imagingRepo.listByPatient(params);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}