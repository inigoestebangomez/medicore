// apps/api/src/infrastructure/database/repositories/clinical-record-lab.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LabReport, LabResult } from '@/domain/clinical-record/lab/lab-report.entity';
import type {
  ILabReportRepository,
  CreateLabReportInput,
  UpdateLabResultReviewInput,
} from '@/domain/clinical-record/lab/lab-report.repository.interface';

@Injectable()
export class PrismaLabReportRepository implements ILabReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByPatient(patientId: string, organizationId: string): Promise<LabReport[]> {
    const records = await this.prisma.labReport.findMany({
      where: { patientId, organizationId },
      include: { results: { orderBy: { index: 'asc' } } },
      orderBy: { recordedAt: 'desc' },
    });
    return records.map((r) => this.toEntity(r));
  }

  async findById(id: string, organizationId: string): Promise<LabReport | null> {
    const record = await this.prisma.labReport.findFirst({
      where: { id, organizationId },
      include: { results: { orderBy: { index: 'asc' } } },
    });
    return record ? this.toEntity(record) : null;
  }

  async create(data: CreateLabReportInput): Promise<LabReport> {
    const record = await this.prisma.labReport.create({
      data: {
        organizationId: data.organizationId,
        patientId: data.patientId,
        s3Key: data.s3Key,
        fileName: data.fileName,
        ocrPayload: data.ocrPayload as any,
        overallReviewState: data.overallReviewState,
        sourceType: data.sourceType,
        authorId: data.authorId,
        recordedAt: data.recordedAt,
        results: {
          create: data.results.map((r) => ({
            index: r.index,
            name: r.name,
            value: r.value,
            unit: r.unit,
            referenceRange: r.referenceRange,
            reviewState: r.reviewState,
          })),
        },
      },
      include: { results: { orderBy: { index: 'asc' } } },
    });
    return this.toEntity(record);
  }

  async updateResultReview(data: UpdateLabResultReviewInput): Promise<LabResult> {
    const record = await this.prisma.labResult.update({
      where: { id: data.resultId },
      data: {
        reviewState: data.reviewState,
        reviewedBy: data.reviewedBy,
        reviewedAt: data.reviewedAt,
      },
    });
    return new LabResult({
      id: record.id,
      labReportId: record.labReportId,
      index: record.index,
      name: record.name,
      value: record.value,
      unit: record.unit,
      referenceRange: record.referenceRange,
      reviewState: record.reviewState,
      reviewedBy: record.reviewedBy,
      reviewedAt: record.reviewedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async updateOverallReviewState(
    reportId: string,
    state: 'UNREVIEWED' | 'CONFIRMED' | 'REJECTED',
  ): Promise<void> {
    await this.prisma.labReport.update({
      where: { id: reportId },
      data: { overallReviewState: state },
    });
  }

  private toEntity(record: any): LabReport {
    return new LabReport({
      id: record.id,
      organizationId: record.organizationId,
      patientId: record.patientId,
      s3Key: record.s3Key,
      fileName: record.fileName,
      ocrPayload: record.ocrPayload,
      overallReviewState: record.overallReviewState,
      sourceType: record.sourceType,
      authorId: record.authorId,
      recordedAt: record.recordedAt,
      results: (record.results ?? []).map((r: any) => this.toResultEntity(r)),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  private toResultEntity(record: any): LabResult {
    return new LabResult({
      id: record.id,
      labReportId: record.labReportId,
      index: record.index,
      name: record.name,
      value: record.value,
      unit: record.unit,
      referenceRange: record.referenceRange,
      reviewState: record.reviewState,
      reviewedBy: record.reviewedBy,
      reviewedAt: record.reviewedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
