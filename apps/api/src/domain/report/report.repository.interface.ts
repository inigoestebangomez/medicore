import type { Report } from './report.entity';
import type { ReportStatus, ReportType } from '@prisma/client';
import type { DiagnosisCodeEntry, ProcedureCodeEntry } from './report.entity';

export interface CreateReportInput {
  organizationId: string;
  patientId: string;
  physicianId: string;
  type: ReportType;
  status?: ReportStatus;
  sourceType?: string | null;
  sourceId?: string | null;
  title: string;
  content: string;
  diagnosisCodes?: DiagnosisCodeEntry[] | null;
  procedureCodes?: ProcedureCodeEntry[] | null;
  aiGenerated?: boolean;
  aiModel?: string | null;
  aiPromptHash?: string | null;
  createdBy: string;
}

export interface UpdateReportInput {
  title?: string;
  content?: string;
  status?: ReportStatus;
  diagnosisCodes?: DiagnosisCodeEntry[] | null;
  procedureCodes?: ProcedureCodeEntry[] | null;
  aiModel?: string | null;
  aiPromptHash?: string | null;
  pdfUrl?: string | null;
  pdfGeneratedAt?: Date | null;
  signedAt?: Date | null;
  signedBy?: string | null;
  updatedBy: string;
}

export interface IReportRepository {
  findById(id: string, organizationId: string): Promise<Report | null>;
  findBySource(sourceType: string, sourceId: string, organizationId: string): Promise<Report | null>;
  findByPatient(patientId: string, organizationId: string): Promise<Report[]>;
  create(data: CreateReportInput): Promise<Report>;
  update(id: string, organizationId: string, data: UpdateReportInput): Promise<Report>;
}
