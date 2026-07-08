import type { Report } from '@/domain/report/report.entity';
import type { IReportRepository } from '@/domain/report/report.repository.interface';
import { AuditLogService } from '@/infrastructure/audit/audit-log.service';
import type { ReportType } from '@prisma/client';
import type { DiagnosisCodeEntry, ProcedureCodeEntry } from '@/domain/report/report.entity';

export interface CreateManualReportCommand {
  organizationId: string;
  patientId: string;
  physicianId: string;
  type: ReportType;
  title: string;
  content: string;
  diagnosisCodes?: DiagnosisCodeEntry[] | null;
  procedureCodes?: ProcedureCodeEntry[] | null;
}

export class CreateManualReportUseCase {
  constructor(
    private readonly reportRepo: IReportRepository,
    private readonly auditLog: AuditLogService,
  ) {}

  async execute(command: CreateManualReportCommand): Promise<Report> {
    const report = await this.reportRepo.create({
      organizationId: command.organizationId,
      patientId: command.patientId,
      physicianId: command.physicianId,
      type: command.type,
      status: 'DRAFT' as any,
      title: command.title,
      content: command.content,
      diagnosisCodes: command.diagnosisCodes,
      procedureCodes: command.procedureCodes,
      aiGenerated: false,
      createdBy: command.physicianId,
    });

    await this.auditLog.log({
      organizationId: command.organizationId,
      userId: command.physicianId,
      action: 'CREATE',
      entityType: 'Report',
      entityId: report.id,
      changes: {
        reportType: command.type,
        aiGenerated: false,
        contentLength: command.content.length,
      },
    });

    return report;
  }
}
