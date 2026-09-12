// apps/api/src/infrastructure/database/repositories/clinical-record-diagnosis.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Diagnosis } from '@/domain/clinical-record/diagnosis/diagnosis.entity';
import type { DiagnosisCodeSystem, DiagnosisStatus } from '@/domain/clinical-record/diagnosis/diagnosis.entity';
import type {
  IDiagnosisRepository,
  CreateDiagnosisInput,
} from '@/domain/clinical-record/diagnosis/diagnosis.repository.interface';

// Map domain enum (hyphens) to Prisma enum (underscores)
function toPrismaCodeSystem(system: DiagnosisCodeSystem): 'CIE_10_ES' | 'SNOMED' {
  return system === 'CIE-10-ES' ? 'CIE_10_ES' : 'SNOMED';
}

function fromPrismaCodeSystem(system: 'CIE_10_ES' | 'SNOMED'): DiagnosisCodeSystem {
  return system === 'CIE_10_ES' ? 'CIE-10-ES' : 'SNOMED';
}

@Injectable()
export class PrismaDiagnosisRepository implements IDiagnosisRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByPatient(patientId: string, organizationId: string): Promise<Diagnosis[]> {
    const records = await this.prisma.diagnosis.findMany({
      where: { patientId, organizationId },
      orderBy: { recordedAt: 'desc' },
    });
    return records.map((r) => this.toEntity(r));
  }

  async findActiveByPatient(patientId: string, organizationId: string): Promise<Diagnosis[]> {
    const records = await this.prisma.diagnosis.findMany({
      where: { patientId, organizationId, status: 'ACTIVE' },
      orderBy: { recordedAt: 'desc' },
    });
    return records.map((r) => this.toEntity(r));
  }

  async findById(id: string, organizationId: string): Promise<Diagnosis | null> {
    const record = await this.prisma.diagnosis.findFirst({
      where: { id, organizationId },
    });
    return record ? this.toEntity(record) : null;
  }

  async create(data: CreateDiagnosisInput): Promise<Diagnosis> {
    const record = await this.prisma.diagnosis.create({
      data: {
        organizationId: data.organizationId,
        patientId: data.patientId,
        system: toPrismaCodeSystem(data.system),
        code: data.code,
        description: data.description,
        catalogVersion: data.catalogVersion,
        status: data.status,
        variables: data.variables as any,
        consultationId: data.consultationId,
        sourceType: data.sourceType,
        authorId: data.authorId,
        recordedAt: data.recordedAt,
      },
    });
    return this.toEntity(record);
  }

  async updateStatus(
    id: string,
    organizationId: string,
    status: DiagnosisStatus,
    extra: { resolvedAt?: Date; discardedAt?: Date; discardedBy?: string },
  ): Promise<Diagnosis> {
    const record = await this.prisma.diagnosis.update({
      where: { id },
      data: {
        status,
        resolvedAt: extra.resolvedAt,
        discardedAt: extra.discardedAt,
        discardedBy: extra.discardedBy,
      },
    });
    // Verify tenant isolation
    if (record.organizationId !== organizationId) {
      throw new Error('Diagnosis not found');
    }
    return this.toEntity(record);
  }

  private toEntity(record: any): Diagnosis {
    return new Diagnosis({
      id: record.id,
      organizationId: record.organizationId,
      patientId: record.patientId,
      system: fromPrismaCodeSystem(record.system),
      code: record.code,
      description: record.description,
      catalogVersion: record.catalogVersion,
      status: record.status,
      variables: (record.variables as Record<string, string | number | boolean>) ?? {},
      consultationId: record.consultationId,
      sourceType: record.sourceType,
      authorId: record.authorId,
      recordedAt: record.recordedAt,
      resolvedAt: record.resolvedAt,
      discardedAt: record.discardedAt,
      discardedBy: record.discardedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
