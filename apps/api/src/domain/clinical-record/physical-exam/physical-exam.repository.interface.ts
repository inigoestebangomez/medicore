// apps/api/src/domain/clinical-record/physical-exam/physical-exam.repository.interface.ts
import type { PhysicalExamTemplate, ExamTemplateField } from './physical-exam-template.entity';
import type { PhysicalExamRecord, CustomFinding } from './physical-exam-record.entity';

export interface CreateExamTemplateInput {
  organizationId: string;
  specialty: string;
  version: number;
  fields: ExamTemplateField[];
  publishedAt: Date;
}

export interface CreateExamRecordInput {
  organizationId: string;
  patientId: string;
  templateId: string;
  templateVersion: number;
  templateSchemaSnapshot: ExamTemplateField[];
  values: Record<string, string | number | boolean>;
  customFindings: CustomFinding[];
  consultationId?: string | null;
  sourceType: string;
  authorId: string;
  recordedAt: Date;
  reviewState: 'UNREVIEWED' | 'CONFIRMED' | 'REJECTED';
}

export interface IPhysicalExamRepository {
  // Templates
  findTemplateById(id: string, organizationId: string): Promise<PhysicalExamTemplate | null>;
  findLatestTemplate(
    organizationId: string,
    specialty: string,
  ): Promise<PhysicalExamTemplate | null>;
  createTemplate(data: CreateExamTemplateInput): Promise<PhysicalExamTemplate>;

  // Records
  findRecordsByPatient(patientId: string, organizationId: string): Promise<PhysicalExamRecord[]>;
  findRecordById(id: string, organizationId: string): Promise<PhysicalExamRecord | null>;
  createRecord(data: CreateExamRecordInput): Promise<PhysicalExamRecord>;
}
