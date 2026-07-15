// apps/api/src/application/import/handlers/get-import-history.handler.ts
// Read-only list of an org's ImportBatches for the history UI. Tenant-scoped
// by the repository. Returns the domain entities; the API layer maps them to
// the response DTO.

import { Injectable, Inject } from '@nestjs/common';
import type { ImportBatch } from '@/domain/import/import-batch.entity';
import type { IImportBatchRepository, ListImportBatchesParams } from '@/domain/import/import-batch.repository.interface';

export interface GetImportHistoryResult {
  items: ImportBatch[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class GetImportHistoryHandler {
  constructor(@Inject('IImportBatchRepository') private readonly batchRepo: IImportBatchRepository) {}

  async execute(params: ListImportBatchesParams): Promise<GetImportHistoryResult> {
    const { items, total } = await this.batchRepo.findByOrg(params);
    return {
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
    };
  }
}
