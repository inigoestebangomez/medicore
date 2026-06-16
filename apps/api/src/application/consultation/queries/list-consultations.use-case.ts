// apps/api/src/application/consultation/queries/list-consultations.use-case.ts

import type { IConsultationRepository, ListConsultationsParams } from '@/domain/consultation/consultation.repository.interface';
import type { ConsultationType } from '@medicore/contracts';

export interface ListConsultationsQuery {
  patientId: string;
  organizationId: string;
  page: number;
  pageSize: number;
  from?: Date;
  to?: Date;
  type?: ConsultationType;
  sortBy: 'date' | 'createdAt';
  sortOrder: 'asc' | 'desc';
}

export interface ListConsultationsResponse {
  items: ConsultationListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ConsultationListItem {
  id: string;
  date: string;
  type: ConsultationType;
  chiefComplaint: string;
  physicianId: string;
  physicianName: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export class ListConsultationsUseCase {
  constructor(private readonly consultationRepo: IConsultationRepository) {}

  async execute(query: ListConsultationsQuery): Promise<ListConsultationsResponse> {
    const { patientId, organizationId, page, pageSize, from, to, type, sortBy, sortOrder } = query;

    const params: ListConsultationsParams = {
      organizationId,
      page,
      pageSize,
      from,
      to,
      type,
      sortBy,
      sortOrder,
    };

    const { items, total } = await this.consultationRepo.listByPatient(patientId, organizationId, params);
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

    const listItems: ConsultationListItem[] = items.map((c) => ({
      id: c.id,
      date: c.date instanceof Date ? c.date.toISOString() : c.date,
      type: c.type,
      chiefComplaint: c.chiefComplaint,
      physicianId: c.physicianId,
      physicianName: c.physicianName,
      createdBy: c.createdBy,
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
      updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
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
