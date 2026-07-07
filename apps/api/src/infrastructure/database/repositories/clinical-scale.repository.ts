// apps/api/src/infrastructure/database/repositories/clinical-scale.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ClinicalScale } from '@/domain/scale/clinical-scale.entity';
import type { IClinicalScaleRepository, CreateClinicalScaleInput, UpdateClinicalScaleInput, ListScalesParams } from '@/domain/scale/scale.repository.interface';

@Injectable()
export class PrismaClinicalScaleRepository implements IClinicalScaleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, organizationId: string): Promise<ClinicalScale | null> {
    const record = await this.prisma.clinicalScale.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!record) return null;
    return this.toEntity(record);
  }

  async listByPatient(params: ListScalesParams): Promise<{ items: ClinicalScale[]; total: number }> {
    const where: Record<string, unknown> = {
      patientId: params.patientId,
      organizationId: params.organizationId,
      deletedAt: null,
    };

    if (params.scaleType) {
      where.scaleType = params.scaleType;
    }

    // BR-SCA-003: Chronological ordering by date descending
    const dateFilter: Record<string, Date> = {};
    if (params.from) dateFilter.gte = params.from;
    if (params.to) dateFilter.lte = params.to;
    if (Object.keys(dateFilter).length > 0) {
      where.date = dateFilter;
    }

    const [records, total] = await Promise.all([
      this.prisma.clinicalScale.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.clinicalScale.count({ where }),
    ]);

    return { items: records.map((r) => this.toEntity(r)), total };
  }

  async create(data: CreateClinicalScaleInput): Promise<ClinicalScale> {
    const record = await this.prisma.clinicalScale.create({
      data: {
        organizationId: data.organizationId,
        patientId: data.patientId,
        consultationId: data.consultationId,
        scaleType: data.scaleType as any,
        date: data.date,
        scores: data.scores as any,
        total: data.total,
        notes: data.notes,
        createdBy: data.createdBy,
        auditLog: data.auditLog ?? undefined,
      },
    });
    return this.toEntity(record);
  }

  async update(id: string, _organizationId: string, data: UpdateClinicalScaleInput): Promise<ClinicalScale> {
    const updateData: Record<string, unknown> = {
      ...data,
      updatedAt: new Date(),
    };

    const record = await this.prisma.clinicalScale.update({
      where: { id },
      data: updateData,
    });
    return this.toEntity(record);
  }

  async softDelete(id: string, _organizationId: string): Promise<ClinicalScale> {
    const record = await this.prisma.clinicalScale.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return this.toEntity(record);
  }

  private toEntity(record: any): ClinicalScale {
    return new ClinicalScale({
      id: record.id,
      organizationId: record.organizationId,
      patientId: record.patientId,
      consultationId: record.consultationId ?? null,
      scaleType: record.scaleType,
      date: record.date,
      scores: record.scores as Record<string, number>,
      total: record.total,
      notes: record.notes ?? null,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy ?? null,
      auditLog: record.auditLog ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt ?? null,
    });
  }
}