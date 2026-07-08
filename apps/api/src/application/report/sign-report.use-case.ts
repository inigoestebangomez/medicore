import type { Report } from '@/domain/report/report.entity';
import type { IReportRepository } from '@/domain/report/report.repository.interface';
import { AuditLogService } from '@/infrastructure/audit/audit-log.service';
import { ReportNotFoundError } from '@/domain/report/errors/report-not-found.error';

export interface SignReportCommand {
  reportId: string;
  organizationId: string;
  physicianId: string;
  confirmDisclaimer: boolean;
}

export class SignReportUseCase {
  constructor(
    private readonly reportRepo: IReportRepository,
    private readonly auditLog: AuditLogService,
  ) {}

  async execute(command: SignReportCommand): Promise<Report> {
    if (!command.confirmDisclaimer) {
      throw new Error('Debe confirmar el disclaimer de responsabilidad antes de firmar el informe (BR-REP-005)');
    }

    const report = await this.reportRepo.findById(command.reportId, command.organizationId);
    if (!report) {
      throw new ReportNotFoundError(command.reportId);
    }

    const signedReport = report.sign(command.physicianId);

    const saved = await this.reportRepo.update(command.reportId, command.organizationId, {
      status: 'SIGNED' as any,
      signedAt: signedReport.signedAt!,
      signedBy: signedReport.signedBy!,
      updatedBy: command.physicianId,
    });

    await this.auditLog.log({
      organizationId: command.organizationId,
      userId: command.physicianId,
      action: 'SIGN',
      entityType: 'Report',
      entityId: command.reportId,
    });

    return saved;
  }
}
