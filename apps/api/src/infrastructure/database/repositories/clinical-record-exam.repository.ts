// apps/api/src/infrastructure/database/repositories/clinical-record-exam.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PhysicalExamTemplate } from '@/domain/clinical-record/physical-exam/physical-exam-template.entity';
import { PhysicalExamRecord } from '@/domain/clinical-record/physical-exam/physical-exam-record.entity';
import type {
  IPhysicalExamRepository,
  CreateExamTemplateInput,
  CreateExamRecordInput,
} from '@/domain/clinical-record/physical-exam/physical-exam.repository.interface';

@Injectable()
export class PrismaPhysicalExamRepository implements IPhysicalExamRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findTemplateById(
    id: string,
    organizationId: string,
  ): Promise<PhysicalExamTemplate | null> {
    const record = await this.prisma.physicalExamTemplate.findFirst({
      where: { id, organizationId },
    });
    return record ? this.toTemplateEntity(record) : null;
  }

  async findLatestTemplate(
    organizationId: string,
    specialty: string,
  ): Promise<PhysicalExamTemplate | null> {
    const record = await this.prisma.physicalExamTemplate.findFirst({
      where: { organizationId, specialty },
      orderBy: { version: 'desc' },
    });
    return record ? this.toTemplateEntity(record) : null;
  }

  async createTemplate(data: CreateExamTemplateInput): Promise<PhysicalExamTemplate> {
    const record = await this.prisma.physicalExamTemplate.create({
      data: {
        organizationId: data.organizationId,
        specialty: data.specialty,
        version: data.version,
        fields: data.fields as any,
        publishedAt: data.publishedAt,
      },
    });
    return this.toTemplateEntity(record);
  }

  async findRecordsByPatient(
    patientId: string,
    organizationId: string,
  ): Promise<PhysicalExamRecord[]> {
    const records = await this.prisma.physicalExamRecord.findMany({
      where: { patientId, organizationId },
      orderBy: { recordedAt: 'desc' },
    });
    return records.map((r) => this.toRecordEntity(r));
  }

  async findRecordById(
    id: string,
    organizationId: string,
  ): Promise<PhysicalExamRecord | null> {
    const record = await this.prisma.physicalExamRecord.findFirst({
      where: { id, organizationId },
    });
    return record ? this.toRecordEntity(record) : null;
  }

  async createRecord(data: CreateExamRecordInput): Promise<PhysicalExamRecord> {
    const record = await this.prisma.physicalExamRecord.create({
      data: {
        organizationId: data.organizationId,
        patientId: data.patientId,
        templateId: data.templateId,
        templateVersion: data.templateVersion,
        templateSchemaSnapshot: data.templateSchemaSnapshot as any,
        values: data.values as any,
        customFindings: data.customFindings as any,
        consultationId: data.consultationId,
        sourceType: data.sourceType,
        authorId: data.authorId,
        recordedAt: data.recordedAt,
        reviewState: data.reviewState,
      },
    });
    return this.toRecordEntity(record);
  }

  private toTemplateEntity(record: any): PhysicalExamTemplate {
    return new PhysicalExamTemplate({
      id: record.id,
      organizationId: record.organizationId,
      specialty: record.specialty,
      version: record.version,
      fields: record.fields as any,
      publishedAt: record.publishedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  private toRecordEntity(record: any): PhysicalExamRecord {
    return new PhysicalExamRecord({
      id: record.id,
      organizationId: record.organizationId,
      patientId: record.patientId,
      templateId: record.templateId,
      templateVersion: record.templateVersion,
      templateSchemaSnapshot: record.templateSchemaSnapshot as any,
      values: record.values as any,
      customFindings: (record.customFindings as any) ?? [],
      consultationId: record.consultationId,
      sourceType: record.sourceType,
      authorId: record.authorId,
      recordedAt: record.recordedAt,
      reviewState: record.reviewState,
      createdAt: record.createdAt,
    });
  }
}
