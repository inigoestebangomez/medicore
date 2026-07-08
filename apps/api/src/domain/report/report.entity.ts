import type { ReportType, ReportStatus } from '@prisma/client';
import { InvalidReportTransitionError } from './errors/invalid-report-transition.error';
import { ReportImmutableError } from './errors/report-immutable.error';

export interface DiagnosisCodeEntry {
  system: string;
  code: string;
  description: string;
  type: string;
}

export interface ProcedureCodeEntry {
  system: string;
  code: string;
  description: string;
}

export interface ReportProps {
  id: string;
  organizationId: string;
  patientId: string;
  physicianId: string;
  type: ReportType;
  status: ReportStatus;
  sourceType?: string | null;
  sourceId?: string | null;
  title: string;
  content: string;
  diagnosisCodes?: DiagnosisCodeEntry[] | null;
  procedureCodes?: ProcedureCodeEntry[] | null;
  aiGenerated?: boolean;
  aiModel?: string | null;
  aiPromptHash?: string | null;
  pdfUrl?: string | null;
  pdfGeneratedAt?: Date | null;
  signedAt?: Date | null;
  signedBy?: string | null;
  createdBy: string;
  updatedBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export class Report {
  readonly id: string;
  readonly organizationId: string;
  readonly patientId: string;
  readonly physicianId: string;
  readonly type: ReportType;
  readonly status: ReportStatus;
  readonly sourceType: string | null;
  readonly sourceId: string | null;
  readonly title: string;
  readonly content: string;
  readonly diagnosisCodes: DiagnosisCodeEntry[] | null;
  readonly procedureCodes: ProcedureCodeEntry[] | null;
  readonly aiGenerated: boolean;
  readonly aiModel: string | null;
  readonly aiPromptHash: string | null;
  readonly pdfUrl: string | null;
  readonly pdfGeneratedAt: Date | null;
  readonly signedAt: Date | null;
  readonly signedBy: string | null;
  readonly createdBy: string;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  static readonly ALLOWED_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
    DRAFT: ['DRAFT', 'REVIEWED'],
    REVIEWED: ['DRAFT', 'SIGNED'],
    SIGNED: [],
  };

  constructor(props: ReportProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.patientId = props.patientId;
    this.physicianId = props.physicianId;
    this.type = props.type;
    this.status = props.status;
    this.sourceType = props.sourceType ?? null;
    this.sourceId = props.sourceId ?? null;
    this.title = props.title;
    this.content = props.content;
    this.diagnosisCodes = (props.diagnosisCodes as DiagnosisCodeEntry[]) ?? null;
    this.procedureCodes = (props.procedureCodes as ProcedureCodeEntry[]) ?? null;
    this.aiGenerated = props.aiGenerated ?? false;
    this.aiModel = props.aiModel ?? null;
    this.aiPromptHash = props.aiPromptHash ?? null;
    this.pdfUrl = props.pdfUrl ?? null;
    this.pdfGeneratedAt = props.pdfGeneratedAt ?? null;
    this.signedAt = props.signedAt ?? null;
    this.signedBy = props.signedBy ?? null;
    this.createdBy = props.createdBy;
    this.updatedBy = props.updatedBy ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    this.deletedAt = props.deletedAt ?? null;
  }

  canTransitionTo(target: ReportStatus): boolean {
    return Report.ALLOWED_TRANSITIONS[this.status]?.includes(target) ?? false;
  }

  sign(physicianId: string): Report {
    if (!this.canTransitionTo('SIGNED')) {
      throw new InvalidReportTransitionError(this.status, 'SIGNED');
    }
    const now = new Date();
    return new Report({
      ...this,
      status: 'SIGNED' as ReportStatus,
      signedAt: now,
      signedBy: physicianId,
      updatedAt: now,
    });
  }

  updateContent(content: string): Report {
    if (this.status === 'SIGNED') {
      throw new ReportImmutableError(this.id);
    }
    return new Report({
      ...this,
      content,
      updatedAt: new Date(),
    });
  }

  updateStatus(status: ReportStatus): Report {
    if (!this.canTransitionTo(status)) {
      throw new InvalidReportTransitionError(this.status, status);
    }
    return new Report({
      ...this,
      status,
      updatedAt: new Date(),
    });
  }

  static create(params: Omit<ReportProps, 'createdAt' | 'updatedAt'> & { id?: string }): Report {
    const id = params.id || crypto.randomUUID();
    return new Report({
      ...params,
      id,
    });
  }
}
