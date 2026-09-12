// apps/api/src/infrastructure/database/repositories/clinical-record-illness.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CurrentIllnessEntry } from '@/domain/clinical-record/current-illness/current-illness-entry.entity';
import type {
  ICurrentIllnessRepository,
  CreateCurrentIllnessInput,
} from '@/domain/clinical-record/current-illness/current-illness.repository.interface';

@Injectable()
export class PrismaCurrentIllnessRepository implements ICurrentIllnessRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByPatient(patientId: string, organizationId: string): Promise<CurrentIllnessEntry[]> {
    const records = await this.prisma.currentIllnessEntry.findMany({
      where: { patientId, organizationId },
      orderBy: { recordedAt: 'desc' },
    });
    return records.map((r) => this.toEntity(r));
  }

  async findById(id: string, organizationId: string): Promise<CurrentIllnessEntry | null> {
    const record = await this.prisma.currentIllnessEntry.findFirst({
      where: { id, organizationId },
    });
    return record ? this.toEntity(record) : null;
  }

  async create(data: CreateCurrentIllnessInput): Promise<CurrentIllnessEntry> {
    const record = await this.prisma.currentIllnessEntry.create({
      data: {
        organizationId: data.organizationId,
        patientId: data.patientId,
        symptoms: data.symptoms,
        durationValue: data.durationValue,
        durationUnit: data.durationUnit,
        onset: data.onset,
        evolution: data.evolution,
        narrative: data.narrative,
        consultationId: data.consultationId,
        sourceType: data.sourceType,
        authorId: data.authorId,
        recordedAt: data.recordedAt,
        reviewState: data.reviewState,
      },
    });
    return this.toEntity(record);
  }

  private toEntity(record: any): CurrentIllnessEntry {
    return new CurrentIllnessEntry({
      id: record.id,
      organizationId: record.organizationId,
      patientId: record.patientId,
      symptoms: record.symptoms,
      durationValue: record.durationValue,
      durationUnit: record.durationUnit,
      onset: record.onset,
      evolution: record.evolution,
      narrative: record.narrative,
      consultationId: record.consultationId,
      sourceType: record.sourceType,
      authorId: record.authorId,
      recordedAt: record.recordedAt,
      reviewState: record.reviewState,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
