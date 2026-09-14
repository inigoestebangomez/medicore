// apps/api/src/infrastructure/database/repositories/consultation.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Consultation } from '@/domain/consultation/consultation.entity';
import type { IConsultationRepository, CreateConsultationInput, UpdateConsultationInput, ListConsultationsParams, SearchLogsParams } from '@/domain/consultation/consultation.repository.interface';
import { hasImportMaterializedMarker } from '@/domain/import/import-provenance';

@Injectable()
export class PrismaConsultationRepository implements IConsultationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, organizationId: string): Promise<Consultation | null> {
    const record = await this.prisma.consultation.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!record) return null;
    return this.toEntity(record);
  }

  async findByPatientId(patientId: string, organizationId: string): Promise<Consultation[]> {
    const records = await this.prisma.consultation.findMany({
      where: { patientId, organizationId, deletedAt: null },
      orderBy: { date: 'desc' },
    });
    return records.map((r) => this.toEntity(r));
  }

  async listByPatient(patientId: string, organizationId: string, params: ListConsultationsParams): Promise<{ items: Consultation[]; total: number }> {
    const where: Record<string, unknown> = {
      patientId,
      organizationId,
      deletedAt: null,
    };

    if (params.type) {
      where.type = params.type;
    }

    if (params.from || params.to) {
      const dateFilter: Record<string, Date> = {};
      if (params.from) dateFilter.gte = params.from;
      if (params.to) dateFilter.lte = params.to;
      where.date = dateFilter;
    }

    const [records, total] = await Promise.all([
      this.prisma.consultation.findMany({
        where,
        orderBy: { [params.sortBy]: params.sortOrder },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.consultation.count({ where }),
    ]);

    return { items: records.map((r) => this.toEntity(r)), total };
  }

  async create(data: CreateConsultationInput): Promise<Consultation> {
    const record = await this.prisma.consultation.create({
      data: {
        organizationId: data.organizationId,
        patientId: data.patientId,
        date: data.date,
        type: data.type as any,
        physicianId: data.physicianId,
        chiefComplaint: data.chiefComplaint,
        currentIllness: data.currentIllness,
        physicalExam: data.physicalExam as any,
        assessment: data.assessment,
        diagnosisCodes: data.diagnosisCodes as any,
        plan: data.plan,
        procedureCodes: data.procedureCodes as any,
        followUpDate: data.followUpDate,
        followUpNotes: data.followUpNotes,
        createdBy: data.createdBy,
      },
    });
    return this.toEntity(record);
  }

  async update(id: string, _organizationId: string, data: UpdateConsultationInput): Promise<Consultation> {
    const updateData: Record<string, unknown> = {
      ...data,
      updatedAt: new Date(),
    };

    const record = await this.prisma.consultation.update({
      where: { id },
      data: updateData,
    });
    return this.toEntity(record);
  }

  async softDelete(id: string, _organizationId: string): Promise<Consultation> {
    const record = await this.prisma.consultation.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return this.toEntity(record);
  }

  async existsFirstVisitForPatient(patientId: string, organizationId: string): Promise<boolean> {
    const count = await this.prisma.consultation.count({
      where: {
        patientId,
        organizationId,
        type: 'FIRST_VISIT',
        deletedAt: null,
      },
    });
    return count > 0;
  }

  async findByImportBatchRow(batchId: string, organizationId: string, rowIndex: number): Promise<Consultation | null> {
    const records = await this.prisma.consultation.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, physicalExam: true },
    });
    const record = records.find((candidate) => hasImportMaterializedMarker(candidate.physicalExam, batchId, rowIndex));
    return record ? this.findById(record.id, organizationId) : null;
  }

  async removeImportedBatch(batchId: string, organizationId: string): Promise<number> {
    const records = await this.prisma.consultation.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, physicalExam: true },
    });
    const imported = records.filter((record) => hasImportMaterializedMarker(record.physicalExam, batchId));
    for (const record of imported) {
      await this.prisma.consultation.update({ where: { id: record.id }, data: { deletedAt: new Date() } });
    }
    return imported.length;
  }

  async searchLogs(params: SearchLogsParams): Promise<{ items: Consultation[]; total: number }> {
    const { patientId, organizationId, query, field, fromDate, toDate, page, pageSize } = params;

    // Build text search conditions
    const searchFields = field
      ? [field]
      : ['chiefComplaint', 'currentIllness', 'assessment', 'plan'];

    const searchConditions = searchFields.map((f) => ({
      [f]: { contains: query, mode: 'insensitive' as const },
    }));

    const where: Record<string, unknown> = {
      patientId,
      organizationId,
      deletedAt: null,
      ...(searchConditions.length === 1
        ? searchConditions[0]
        : { OR: searchConditions }),
    };

    if (fromDate || toDate) {
      const dateFilter: Record<string, Date> = {};
      if (fromDate) dateFilter.gte = fromDate;
      if (toDate) dateFilter.lte = toDate;
      where.date = dateFilter;
    }

    const [records, total] = await Promise.all([
      this.prisma.consultation.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.consultation.count({ where }),
    ]);

    return { items: records.map((r) => this.toEntity(r)), total };
  }

  private toEntity(record: any): Consultation {
    return new Consultation({
      id: record.id,
      patientId: record.patientId,
      organizationId: record.organizationId,
      date: record.date,
      type: record.type,
      physicianId: record.physicianId,
      physicianName: record.physicianName ?? null,
      chiefComplaint: record.chiefComplaint,
      currentIllness: record.currentIllness,
      physicalExam: record.physicalExam,
      assessment: record.assessment,
      diagnosisCodes: record.diagnosisCodes ?? [],
      plan: record.plan,
      procedureCodes: record.procedureCodes ?? [],
      followUpDate: record.followUpDate,
      followUpNotes: record.followUpNotes,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
  }
}
