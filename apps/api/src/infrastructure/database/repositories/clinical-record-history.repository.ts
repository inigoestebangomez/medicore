// apps/api/src/infrastructure/database/repositories/clinical-record-history.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PatientHistoryEntry } from '@/domain/clinical-record/history/patient-history-entry.entity';
import type {
  IHistoryRepository,
  CreateHistoryEntryInput,
} from '@/domain/clinical-record/history/history.repository.interface';
import type { HistoryEntryType } from '@/domain/clinical-record/history/patient-history-entry.entity';

@Injectable()
export class PrismaHistoryRepository implements IHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByPatient(patientId: string, organizationId: string): Promise<PatientHistoryEntry[]> {
    const records = await this.prisma.patientHistoryEntry.findMany({
      where: { patientId, organizationId },
      orderBy: { recordedAt: 'desc' },
    });
    return records.map((r) => this.toEntity(r));
  }

  async findByPatientAndType(
    patientId: string,
    organizationId: string,
    entryType: HistoryEntryType,
  ): Promise<PatientHistoryEntry[]> {
    const records = await this.prisma.patientHistoryEntry.findMany({
      where: { patientId, organizationId, entryType },
      orderBy: { recordedAt: 'desc' },
    });
    return records.map((r) => this.toEntity(r));
  }

  async findById(id: string, organizationId: string): Promise<PatientHistoryEntry | null> {
    const record = await this.prisma.patientHistoryEntry.findFirst({
      where: { id, organizationId },
    });
    return record ? this.toEntity(record) : null;
  }

  async create(data: CreateHistoryEntryInput): Promise<PatientHistoryEntry> {
    const record = await this.prisma.patientHistoryEntry.create({
      data: {
        organizationId: data.organizationId,
        patientId: data.patientId,
        entryType: data.entryType,
        key: data.key,
        value: data.value,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        authorId: data.authorId,
        recordedAt: data.recordedAt,
        reviewState: data.reviewState,
      },
    });
    return this.toEntity(record);
  }

  private toEntity(record: any): PatientHistoryEntry {
    return new PatientHistoryEntry({
      id: record.id,
      organizationId: record.organizationId,
      patientId: record.patientId,
      entryType: record.entryType,
      key: record.key,
      value: record.value,
      sourceType: record.sourceType,
      sourceId: record.sourceId,
      authorId: record.authorId,
      recordedAt: record.recordedAt,
      reviewState: record.reviewState,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
