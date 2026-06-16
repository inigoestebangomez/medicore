// apps/api/src/infrastructure/database/repositories/surgery.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Surgery } from '@/domain/surgery/surgery.entity';
import type { ISurgeryRepository, CreateSurgeryInput, UpdateSurgeryInput, ListSurgeriesParams } from '@/domain/surgery/surgery.repository.interface';

@Injectable()
export class PrismaSurgeryRepository implements ISurgeryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, organizationId: string): Promise<Surgery | null> {
    const record = await this.prisma.surgery.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!record) return null;
    return this.toEntity(record);
  }

  async findByPatientId(id: string, patientId: string, organizationId: string): Promise<Surgery | null> {
    const record = await this.prisma.surgery.findFirst({
      where: { id, patientId, organizationId, deletedAt: null },
    });
    if (!record) return null;
    return this.toEntity(record);
  }

  async listByPatient(params: ListSurgeriesParams): Promise<{ items: Surgery[]; total: number }> {
    const where: Record<string, unknown> = {
      patientId: params.patientId,
      organizationId: params.organizationId,
      deletedAt: null,
    };

    if (params.status) {
      where.status = params.status;
    }

    if (params.from || params.to) {
      const dateFilter: Record<string, Date> = {};
      if (params.from) dateFilter.gte = params.from;
      if (params.to) dateFilter.lte = params.to;
      where.date = dateFilter;
    }

    const [records, total] = await Promise.all([
      this.prisma.surgery.findMany({
        where,
        orderBy: { [params.sortBy]: params.sortOrder },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.surgery.count({ where }),
    ]);

    return { items: records.map((r) => this.toEntity(r)), total };
  }

  async create(data: CreateSurgeryInput): Promise<Surgery> {
    const record = await this.prisma.surgery.create({
      data: {
        organizationId: data.organizationId,
        patientId: data.patientId,
        physicianId: data.physicianId,
        date: data.date,
        status: data.status as any,
        procedureType: data.procedureType,
        procedureCodes: data.procedureCodes as any,
        asa: data.asa as any,
        anesthesiaType: data.anesthesiaType,
        preOpNotes: data.preOpNotes,
        preOpChecklist: data.preOpChecklist as any,
        duration: data.duration,
        technique: data.technique as any,
        findings: data.findings,
        complications: data.complications,
        postOpNotes: data.postOpNotes,
        postOpProtocol: data.postOpProtocol as any,
        outcome: data.outcome,
        createdBy: data.createdBy,
        auditLog: data.auditLog as any,
      },
    });
    return this.toEntity(record);
  }

  async update(id: string, _organizationId: string, data: UpdateSurgeryInput): Promise<Surgery> {
    const updateData: Record<string, unknown> = {
      ...data,
      updatedAt: new Date(),
    };

    const record = await this.prisma.surgery.update({
      where: { id },
      data: updateData,
    });
    return this.toEntity(record);
  }

  async softDelete(id: string, _organizationId: string): Promise<Surgery> {
    const record = await this.prisma.surgery.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return this.toEntity(record);
  }

  async hasScheduledSurgeries(patientId: string, organizationId: string): Promise<boolean> {
    const count = await this.prisma.surgery.count({
      where: {
        patientId,
        organizationId,
        status: { in: ['SCHEDULED', 'POSTPONED'] },
        deletedAt: null,
      },
    });
    return count > 0;
  }

  private toEntity(record: any): Surgery {
    return new Surgery({
      id: record.id,
      organizationId: record.organizationId,
      patientId: record.patientId,
      physicianId: record.physicianId,
      date: record.date,
      status: record.status,
      procedureType: record.procedureType,
      procedureCodes: record.procedureCodes ?? null,
      asa: record.asa ?? null,
      anesthesiaType: record.anesthesiaType ?? null,
      preOpNotes: record.preOpNotes ?? null,
      preOpChecklist: record.preOpChecklist ?? null,
      duration: record.duration ?? null,
      technique: record.technique ?? null,
      findings: record.findings ?? null,
      complications: record.complications ?? null,
      postOpNotes: record.postOpNotes ?? null,
      postOpProtocol: record.postOpProtocol ?? null,
      outcome: record.outcome ?? null,
      editReason: record.editReason ?? null,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy ?? null,
      auditLog: record.auditLog ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt ?? null,
    });
  }
}