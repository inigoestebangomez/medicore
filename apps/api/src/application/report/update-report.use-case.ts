import type { Report } from '@/domain/report/report.entity';
import type { IReportRepository } from '@/domain/report/report.repository.interface';
import { AuditLogService } from '@/infrastructure/audit/audit-log.service';
import { ReportNotFoundError } from '@/domain/report/errors/report-not-found.error';

export interface UpdateReportCommand {
  reportId: string;
  organizationId: string;
  physicianId: string;
  title?: string;
  content?: string;
  status?: string;
  diagnosisCodes?: any[] | null;
  procedureCodes?: any[] | null;
}

export class UpdateReportUseCase {
  constructor(
    private readonly reportRepo: IReportRepository,
    private readonly auditLog: AuditLogService,
  ) {}

  async execute(command: UpdateReportCommand): Promise<Report> {
    const report = await this.reportRepo.findById(command.reportId, command.organizationId);
    if (!report) {
      throw new ReportNotFoundError(command.reportId);
    }

    if (command.status !== undefined && command.status !== report.status) {
      report.updateStatus(command.status as any);
    }

    if (command.content !== undefined && command.content !== report.content) {
      report.updateContent(command.content);
    }

    const updateData: any = { updatedBy: command.physicianId };

    if (command.title !== undefined) updateData.title = command.title;
    if (command.content !== undefined) updateData.content = command.content;
    if (command.status !== undefined) updateData.status = command.status;
    if (command.diagnosisCodes !== undefined) updateData.diagnosisCodes = command.diagnosisCodes;
    if (command.procedureCodes !== undefined) updateData.procedureCodes = command.procedureCodes;

    const saved = await this.reportRepo.update(command.reportId, command.organizationId, updateData);

    await this.auditLog.log({
      organizationId: command.organizationId,
      userId: command.physicianId,
      action: 'UPDATE',
      entityType: 'Report',
      entityId: command.reportId,
      changes: updateData,
    });

    return saved;
  }
}
