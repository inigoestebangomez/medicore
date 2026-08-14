// apps/api/src/application/surgery/queries/list-org-surgeries.use-case.ts

import type {
  ISurgeryRepository,
  ListOrgSurgeriesParams,
} from '@/domain/surgery/surgery.repository.interface';
import type { Surgery } from '@/domain/surgery/surgery.entity';
import type { SurgeryStatus, OrgSurgeryListItem } from '@medicore/contracts';

export interface ListOrgSurgeriesQuery {
  organizationId: string;
  page: number;
  pageSize: number;
  from?: Date;
  to?: Date;
  status?: SurgeryStatus;
  physicianId?: string;
  sortBy: 'date' | 'createdAt';
  sortOrder: 'asc' | 'desc';
}

export interface ListOrgSurgeriesResponse {
  items: OrgSurgeryListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListOrgSurgeriesUseCase {
  constructor(private readonly surgeryRepo: ISurgeryRepository) {}

  async execute(query: ListOrgSurgeriesQuery): Promise<ListOrgSurgeriesResponse> {
    const {
      organizationId,
      page,
      pageSize,
      from,
      to,
      status,
      physicianId,
      sortBy,
      sortOrder,
    } = query;

    const params: ListOrgSurgeriesParams = {
      organizationId,
      page,
      pageSize,
      from,
      to,
      status,
      physicianId,
      sortBy,
      sortOrder,
    };

    const { items, total, patientNames } = await this.surgeryRepo.listByOrganization(params);
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

    const listItems: OrgSurgeryListItem[] = items.map((s: Surgery) => {
      const patient = patientNames.get(s.patientId);
      return {
        id: s.id,
        patientId: s.patientId,
        patientFirstName: patient?.firstName ?? '',
        patientLastName: patient?.lastName ?? '',
        date: s.date instanceof Date ? s.date.toISOString() : s.date,
        status: s.status,
        procedureType: s.procedureType,
        physicianId: s.physicianId,
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