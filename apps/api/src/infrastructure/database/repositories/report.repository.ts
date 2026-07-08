import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Report } from '@/domain/report/report.entity';
import type { IReportRepository, CreateReportInput, UpdateReportInput } from '@/domain/report/report.repository.interface';

@Injectable()
export class PrismaReportRepository implements IReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, organizationId: string): Promise<Report | null> {
    const record = await this.prisma.report.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!record) return null;
    return this.toEntity(record);
  }

  async findBySource(sourceType: string, sourceId: string, organizationId: string): Promise<Report | null> {
    const record = await this.prisma.report.findFirst({
      where: { sourceType, sourceId, organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) return null;
    return this.toEntity(record);
  }

  async findByPatient(patientId: string, organizationId: string): Promise<Report[]> {
    const records = await this.prisma.report.findMany({
      where: { patientId, organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toEntity(r));
  }

  async create(data: CreateReportInput): Promise<Report> {
    const record = await this.prisma.report.create({
      data: {
        organizationId: data.organizationId,
        patientId: data.patientId,
        physicianId: data.physicianId,
        type: data.type as any,
        status: (data.status ?? 'DRAFT') as any,
        sourceType: data.sourceType ?? null,
        sourceId: data.sourceId ?? null,
        title: data.title,
        content: data.content,
        diagnosisCodes: data.diagnosisCodes as any,
        procedureCodes: data.procedureCodes as any,
        aiGenerated: data.aiGenerated ?? false,
        aiModel: data.aiModel ?? null,
        aiPromptHash: data.aiPromptHash ?? null,
        createdBy: data.createdBy,
      },
    });
    return this.toEntity(record);
  }

  async update(id: string, _organizationId: string, data: UpdateReportInput): Promise<Report> {
    const updateData: Record<string, unknown> = {
      ...data,
      updatedAt: new Date(),
    };

    const record = await this.prisma.report.update({
      where: { id },
      data: updateData as any,
    });
    return this.toEntity(record);
  }

  private toEntity(record: any): Report {
    return new Report({
      id: record.id,
      organizationId: record.organizationId,
      patientId: record.patientId,
      physicianId: record.physicianId,
      type: record.type,
      status: record.status,
      sourceType: record.sourceType,
      sourceId: record.sourceId,
      title: record.title,
      content: record.content,
      diagnosisCodes: record.diagnosisCodes,
      procedureCodes: record.procedureCodes,
      aiGenerated: record.aiGenerated,
      aiModel: record.aiModel,
      aiPromptHash: record.aiPromptHash,
      pdfUrl: record.pdfUrl,
      pdfGeneratedAt: record.pdfGeneratedAt,
      signedAt: record.signedAt,
      signedBy: record.signedBy,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
  }
}
