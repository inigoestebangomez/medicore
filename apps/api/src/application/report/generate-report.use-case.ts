import crypto from 'crypto';
import { Report } from '@/domain/report/report.entity';
import type { ReportType } from '@prisma/client';
import type { IReportRepository } from '@/domain/report/report.repository.interface';
import type { IConsultationRepository } from '@/domain/consultation/consultation.repository.interface';
import type { ISurgeryRepository } from '@/domain/surgery/surgery.repository.interface';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import type { ReportGenerationInput } from '@/infrastructure/ai/anthropic.service';
import type { AiProvider } from '@/infrastructure/billing/ai-provider/ai-provider.interface';
import { AuditLogService } from '@/infrastructure/audit/audit-log.service';
import { ReportNotFoundError } from '@/domain/report/errors/report-not-found.error';

export interface GenerateReportCommand {
  sourceType: 'consultation' | 'surgery';
  sourceId: string;
  patientId: string;
  organizationId: string;
  physicianId: string;
  physicianName: string;
  reportType: ReportType;
  title?: string;
}

export class GenerateReportUseCase {
  constructor(
    private readonly reportRepo: IReportRepository,
    private readonly consultationRepo: IConsultationRepository,
    private readonly surgeryRepo: ISurgeryRepository,
    private readonly patientRepo: IPatientRepository,
    private readonly aiProvider: AiProvider,
    private readonly auditLog: AuditLogService,
  ) {}

  async execute(command: GenerateReportCommand): Promise<Report> {
    // Model name is sourced from the active AiProvider strategy so audit logs
    // reflect whichever provider is configured (Claude / Ollama / open-code-go).
    const model = this.aiProvider.modelName;

    const title = command.title ?? this.defaultTitle(command.reportType, command.sourceType);

    const report = await this.reportRepo.create({
      organizationId: command.organizationId,
      patientId: command.patientId,
      physicianId: command.physicianId,
      type: command.reportType,
      status: 'DRAFT' as any,
      sourceType: command.sourceType,
      sourceId: command.sourceId,
      title,
      content: '',
      aiGenerated: true,
      aiModel: model,
      aiPromptHash: null,
      createdBy: command.physicianId,
    });

    try {
      const input = await this.buildGenerationInput(command);
      const promptHash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
      const content = await this.aiProvider.generateReport(input);

      const updatedReport = report
        .updateContent(content);

      const saved = await this.reportRepo.update(report.id, command.organizationId, {
        title: updatedReport.title,
        content: updatedReport.content,
        status: 'DRAFT' as any,
        aiModel: model,
        aiPromptHash: promptHash,
        updatedBy: command.physicianId,
      });

      await this.auditLog.log({
        organizationId: command.organizationId,
        userId: command.physicianId,
        action: 'CREATE',
        entityType: 'Report',
        entityId: report.id,
        changes: {
          sourceType: command.sourceType,
          sourceId: command.sourceId,
          reportType: command.reportType,
          aiGenerated: true,
          aiModel: model,
          contentLength: content.length,
        },
      });

      return saved;
    } catch (error) {
      this.auditLog.log({
        organizationId: command.organizationId,
        userId: command.physicianId,
        action: 'CREATE',
        entityType: 'Report',
        entityId: report.id,
        changes: {
          sourceType: command.sourceType,
          sourceId: command.sourceId,
          reportType: command.reportType,
          aiGenerated: true,
          error: (error as Error).message,
        },
      }).catch(() => {});

      throw error;
    }
  }

  private async buildGenerationInput(command: GenerateReportCommand): Promise<ReportGenerationInput> {
    const patient = await this.patientRepo.findById(command.patientId, command.organizationId);
    if (!patient) {
      throw new ReportNotFoundError(command.sourceId);
    }

    const input: ReportGenerationInput = {
      patientName: `${patient.firstName} ${patient.lastName}`,
      patientNhc: patient.nhc,
      consultationType: command.reportType.replace(/_/g, ' '),
      chiefComplaint: '',
    };

    if (command.sourceType === 'consultation') {
      const consultation = await this.consultationRepo.findById(command.sourceId, command.organizationId);
      if (!consultation) {
        throw new ReportNotFoundError(command.sourceId);
      }
      input.chiefComplaint = consultation.chiefComplaint ?? '';
      input.currentIllness = consultation.currentIllness ?? undefined;
      input.physicalExam = consultation.physicalExam as Record<string, unknown> | undefined;
      input.assessment = consultation.assessment ?? undefined;
      input.diagnosisCodes = consultation.diagnosisCodes as any;
      input.plan = consultation.plan ?? undefined;
    } else if (command.sourceType === 'surgery') {
      const surgery = await this.surgeryRepo.findById(command.sourceId, command.organizationId);
      if (!surgery) {
        throw new ReportNotFoundError(command.sourceId);
      }
      input.consultationType = 'SURGICAL_REPORT';
      input.chiefComplaint = surgery.procedureType ?? '';
      input.surgeryType = surgery.procedureType ?? undefined;
      input.surgeryFindings = surgery.findings ?? undefined;
      input.relevantHistory = surgery.preOpNotes ?? surgery.postOpNotes ?? undefined;
    }

    return input;
  }

  private defaultTitle(reportType: ReportType, sourceType: string): string {
    const titles: Record<string, string> = {
      DISCHARGE_SUMMARY: 'Informe de alta',
      SURGICAL_REPORT: 'Informe quirúrgico',
      REFERRAL_LETTER: 'Carta de derivación',
      MEDICAL_CERTIFICATE: 'Certificado médico',
      FOLLOW_UP_REPORT: 'Informe de revisión',
      PATHOLOGY_REPORT: 'Informe de anatomía patológica',
    };
    return titles[reportType] ?? `${sourceType === 'surgery' ? 'Informe quirúrgico' : 'Informe clínico'}`;
  }
}
