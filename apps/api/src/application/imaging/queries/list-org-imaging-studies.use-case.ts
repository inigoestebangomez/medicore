// apps/api/src/application/imaging/queries/list-org-imaging-studies.use-case.ts

import type {
  IImagingStudyRepository,
  ListOrgImagingStudiesParams,
} from '@/domain/imaging/imaging-study.repository.interface';
import type { ImagingStudy } from '@/domain/imaging/imaging-study.entity';
import type { ImagingStudyType, OrgImagingStudyListItem } from '@medicore/contracts';

export interface ListOrgImagingStudiesQuery {
  organizationId: string;
  page: number;
  pageSize: number;
  from?: Date;
  to?: Date;
  type?: ImagingStudyType;
  sortBy: 'date' | 'createdAt';
  sortOrder: 'asc' | 'desc';
}

export interface ListOrgImagingStudiesResponse {
  items: OrgImagingStudyListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListOrgImagingStudiesUseCase {
  constructor(private readonly imagingRepo: IImagingStudyRepository) {}

  async execute(query: ListOrgImagingStudiesQuery): Promise<ListOrgImagingStudiesResponse> {
    const {
      organizationId,
      page,
      pageSize,
      from,
      to,
      type,
      sortBy,
      sortOrder,
    } = query;

    const params: ListOrgImagingStudiesParams = {
      organizationId,
      page,
      pageSize,
      from,
      to,
      type,
      sortBy,
      sortOrder,
    };

    const { items, total, patientNames } = await this.imagingRepo.listByOrganization(params);
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

    const listItems: OrgImagingStudyListItem[] = items.map((s: ImagingStudy) => {
      const patient = patientNames.get(s.patientId);
      return {
        id: s.id,
        patientId: s.patientId,
        patientFirstName: patient?.firstName ?? '',
        patientLastName: patient?.lastName ?? '',
        type: s.type,
        date: s.date instanceof Date ? s.date.toISOString() : s.date,
        description: s.description,
        findings: s.findings,
        files: s.files,
        createdBy: s.createdBy,
        createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
      };
    });

    return {
      items: listItems,
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}