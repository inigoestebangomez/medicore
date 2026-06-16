// apps/api/src/application/consultation/queries/search-consultation-logs.use-case.ts

import type { IConsultationRepository, SearchLogsParams } from '@/domain/consultation/consultation.repository.interface';
import type { Consultation } from '@/domain/consultation/consultation.entity';
import type { SearchConsultationLogs } from '@medicore/contracts';

export interface SearchConsultationLogsResult {
  items: Consultation[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class SearchConsultationLogsUseCase {
  constructor(private readonly consultationRepo: IConsultationRepository) {}

  async execute(
    patientId: string,
    organizationId: string,
    params: SearchConsultationLogs,
  ): Promise<SearchConsultationLogsResult> {
    const searchParams: SearchLogsParams = {
      patientId,
      organizationId,
      query: params.query,
      field: params.field,
      fromDate: params.fromDate ? new Date(params.fromDate) : undefined,
      toDate: params.toDate ? new Date(params.toDate) : undefined,
      page: params.page,
      pageSize: params.pageSize,
    };

    const { items, total } = await this.consultationRepo.searchLogs(searchParams);
    const totalPages = total > 0 ? Math.ceil(total / params.pageSize) : 0;

    return {
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages,
    };
  }
}