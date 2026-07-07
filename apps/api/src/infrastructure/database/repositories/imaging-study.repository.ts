// apps/api/src/infrastructure/database/repositories/imaging-study.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ImagingStudy } from '@/domain/imaging/imaging-study.entity';
import type { IImagingStudyRepository, ListImagingStudiesParams, CreateImagingStudyInput, UpdateImagingStudyInput } from '@/domain/imaging/imaging-study.repository.interface';
import type { FileMetadataEntry } from '@/domain/imaging/imaging-study.entity';

@Injectable()
export class PrismaImagingStudyRepository implements IImagingStudyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, organizationId: string): Promise<ImagingStudy | null> {
    const record = await this.prisma.imagingStudy.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!record) return null;
    return this.toEntity(record);
  }

  async findByPatientId(id: string, patientId: string, organizationId: string): Promise<ImagingStudy | null> {
    const record = await this.prisma.imagingStudy.findFirst({
      where: { id, patientId, organizationId, deletedAt: null },
    });
    if (!record) return null;
    return this.toEntity(record);
  }

  async listByPatient(params: ListImagingStudiesParams): Promise<{ items: ImagingStudy[]; total: number }> {
    const where: Record<string, unknown> = {
      patientId: params.patientId,
      organizationId: params.organizationId,
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
      this.prisma.imagingStudy.findMany({
        where,
        orderBy: { [params.sortBy]: params.sortOrder },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.imagingStudy.count({ where }),
    ]);

    return { items: records.map((r) => this.toEntity(r)), total };
  }

  async create(data: CreateImagingStudyInput): Promise<ImagingStudy> {
    const record = await this.prisma.imagingStudy.create({
      data: {
        organizationId: data.organizationId,
        patientId: data.patientId,
        surgeryId: data.surgeryId ?? null,
        consultationId: data.consultationId ?? null,
        type: data.type as any,
        date: data.date,
        description: data.description ?? null,
        findings: data.findings ?? null,
        labels: data.labels as any ?? null,
        files: data.files ?? [],
        createdBy: data.createdBy,
      },
    });
    return this.toEntity(record);
  }

  async update(id: string, _organizationId: string, data: UpdateImagingStudyInput): Promise<ImagingStudy> {
    const updateData: Record<string, unknown> = {
      ...data,
      updatedAt: new Date(),
    };

    const record = await this.prisma.imagingStudy.update({
      where: { id },
      data: updateData,
    });
    return this.toEntity(record);
  }

  async appendFiles(id: string, _organizationId: string, files: FileMetadataEntry[]): Promise<ImagingStudy> {
    const existing = await this.prisma.imagingStudy.findFirst({
      where: { id },
    });
    if (!existing) throw new Error(`ImagingStudy not found: ${id}`);

    const currentFiles = (existing.files as any[]) ?? [];
    const updatedFiles = [...currentFiles, ...files];

    const record = await this.prisma.imagingStudy.update({
      where: { id },
      data: { files: updatedFiles, updatedAt: new Date() },
    });
    return this.toEntity(record);
  }

  async softDelete(id: string, _organizationId: string): Promise<ImagingStudy> {
    const record = await this.prisma.imagingStudy.update({
      where: { id },
      data: { deletedAt: new Date(), updatedAt: new Date() },
    });
    return this.toEntity(record);
  }

  private toEntity(record: any): ImagingStudy {
    return new ImagingStudy({
      id: record.id,
      organizationId: record.organizationId,
      patientId: record.patientId,
      surgeryId: record.surgeryId ?? null,
      consultationId: record.consultationId ?? null,
      type: record.type,
      date: record.date,
      description: record.description ?? null,
      findings: record.findings ?? null,
      labels: record.labels ?? null,
      files: (record.files as any[]) ?? [],
      createdBy: record.createdBy,
      updatedBy: record.updatedBy ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt ?? null,
    });
  }
}