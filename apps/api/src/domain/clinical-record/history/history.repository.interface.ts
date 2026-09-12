// apps/api/src/domain/clinical-record/history/history.repository.interface.ts
import type { PatientHistoryEntry, HistoryEntryType } from './patient-history-entry.entity';

export interface CreateHistoryEntryInput {
  organizationId: string;
  patientId: string;
  entryType: HistoryEntryType;
  key: string;
  value: string;
  sourceType: string;
  sourceId?: string | null;
  authorId: string;
  recordedAt: Date;
  reviewState: 'UNREVIEWED' | 'CONFIRMED' | 'REJECTED';
}

export interface IHistoryRepository {
  findByPatient(patientId: string, organizationId: string): Promise<PatientHistoryEntry[]>;
  findByPatientAndType(
    patientId: string,
    organizationId: string,
    entryType: HistoryEntryType,
  ): Promise<PatientHistoryEntry[]>;
  findById(id: string, organizationId: string): Promise<PatientHistoryEntry | null>;
  create(data: CreateHistoryEntryInput): Promise<PatientHistoryEntry>;
}
