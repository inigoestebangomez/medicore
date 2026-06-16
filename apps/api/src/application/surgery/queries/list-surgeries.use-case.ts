// apps/api/src/application/surgery/queries/list-surgeries.use-case.ts

import type { ISurgeryRepository, ListSurgeriesParams } from '@/domain/surgery/surgery.repository.interface';
import type { Surgery } from '@/domain/surgery/surgery.entity';
import type { SurgeryStatus } from '@medicore/contracts';

export interface ListSurgeriesQuery {
  patientId: string;
  organizationId: string;
  page: number;
  pageSize: number;
  from?: Date;
  to?: Date;
  status?: SurgeryStatus;
  sortBy: 'date' | 'createdAt';
  sortOrder: 'asc' | 'desc';
}

export interface SurgeryListItem {
  id: string;
  patientId: string;
  date: string;
  status: SurgeryStatus;
  procedureType: string;
  physicianId: string;
  asa: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListSurgeriesResponse {
  items: SurgeryListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListSurgeriesUseCase {
  constructor(private readonly surgeryRepo: ISurgeryRepository) {}

  async execute(query: ListSurgeriesQuery): Promise<ListSurgeriesResponse> {
    const { patientId, organizationId, page, pageSize, from, to, status, sortBy, sortOrder } = query;

    const params: ListSurgeriesParams = {
      patientId,
      organizationId,
      page,
      pageSize,
      from,
      to,
      status,
      sortBy,
      sortOrder,
    };

    const { items, total } = await this.surgeryRepo.listByPatient(params);
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

    const listItems: SurgeryListItem[] = items.map((s: Surgery) => ({
      id: s.id,
      patientId: s.patientId,
      date: s.date instanceof Date ? s.date.toISOString() : s.date,
      status: s.status,
      procedureType: s.procedureType,
      physicianId: s.physicianId,
      asa: s.asa,
      createdBy: s.createdBy,
      createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
      updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
    }));

    return {
      items: listItems,
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}