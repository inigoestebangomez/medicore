// apps/api/src/application/clinical-record/commands/create-history-entry.use-case.ts
// Use-case: Create a history entry with provenance (spec §2).
// Unknown values remain null/unknown — never inferred from medication or free text.

import type { IHistoryRepository } from '@/domain/clinical-record/history/history.repository.interface';
import type { HistoryEntryType } from '@/domain/clinical-record/history/patient-history-entry.entity';

export interface CreateHistoryEntryCommand {
  organizationId: string;
  patientId: string;
  entryType: HistoryEntryType;
  key: string;
  value: string;
  sourceType: string;
  sourceId?: string | null;
  authorId: string;
}

export class CreateHistoryEntryUseCase {
  constructor(private readonly historyRepo: IHistoryRepository) {}

  async execute(cmd: CreateHistoryEntryCommand) {
    return this.historyRepo.create({
      organizationId: cmd.organizationId,
      patientId: cmd.patientId,
      entryType: cmd.entryType,
      key: cmd.key,
      value: cmd.value,
      sourceType: cmd.sourceType,
      sourceId: cmd.sourceId ?? null,
      authorId: cmd.authorId,
      recordedAt: new Date(),
      reviewState: 'UNREVIEWED',
    });
  }
}
