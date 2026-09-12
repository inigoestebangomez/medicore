// apps/api/src/application/clinical-record/commands/create-exam-record.use-case.ts
// Use-case: Create a physical exam record with template version pinning (spec §4).
// The record pins the template version and schema snapshot at creation time,
// so historical exams remain interpretable after template changes.

import type { IPhysicalExamRepository } from '@/domain/clinical-record/physical-exam/physical-exam.repository.interface';
import type { CustomFinding } from '@/domain/clinical-record/physical-exam/physical-exam-record.entity';

export interface CreateExamRecordCommand {
  organizationId: string;
  patientId: string;
  templateId: string;
  values: Record<string, string | number | boolean>;
  customFindings?: CustomFinding[];
  consultationId?: string | null;
  sourceType: string;
  authorId: string;
}

export class CreateExamRecordUseCase {
  constructor(private readonly examRepo: IPhysicalExamRepository) {}

  async execute(cmd: CreateExamRecordCommand) {
    // 1. Load the template to pin version + schema snapshot
    const template = await this.examRepo.findTemplateById(cmd.templateId, cmd.organizationId);
    if (!template) {
      throw new Error('Exam template not found');
    }

    // 2. Validate required fields from the template
    for (const field of template.requiredFields) {
      if (cmd.values[field.key] === undefined || cmd.values[field.key] === null || cmd.values[field.key] === '') {
        throw new Error(`Required field '${field.key}' is missing`);
      }
    }

    // 3. Create the record with pinned snapshot
    return this.examRepo.createRecord({
      organizationId: cmd.organizationId,
      patientId: cmd.patientId,
      templateId: template.id,
      templateVersion: template.version,
      templateSchemaSnapshot: [...template.fields], // immutable snapshot
      values: cmd.values,
      customFindings: cmd.customFindings ?? [],
      consultationId: cmd.consultationId ?? null,
      sourceType: cmd.sourceType,
      authorId: cmd.authorId,
      recordedAt: new Date(),
      reviewState: 'UNREVIEWED',
    });
  }
}
