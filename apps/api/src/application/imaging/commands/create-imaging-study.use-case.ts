// apps/api/src/application/imaging/commands/create-imaging-study.use-case.ts
// BR-IMG-001: MIME validation happens in FileValidationPipe, not here
// BR-TRX-001: organizationId enforced via tenant isolation

import type { IImagingStudyRepository, CreateImagingStudyInput } from '@/domain/imaging/imaging-study.repository.interface';
import type { ImagingStudy } from '@/domain/imaging/imaging-study.entity';
import type { ImagingStudyType } from '@medicore/contracts';

export interface CreateImagingStudyCommand {
  organizationId: string;
  patientId: string;
  type: ImagingStudyType;
  date: Date;
  description?: string | null;
  surgeryId?: string | null;
  consultationId?: string | null;
  findings?: string | null;
  labels?: any[] | null;
  createdBy: string;
}

export class CreateImagingStudyUseCase {
  constructor(private readonly imagingRepo: IImagingStudyRepository) {}

  async execute(command: CreateImagingStudyCommand): Promise<ImagingStudy> {
    const data: CreateImagingStudyInput = {
      organizationId: command.organizationId,
      patientId: command.patientId,
      type: command.type,
      date: command.date,
      description: command.description ?? null,
      surgeryId: command.surgeryId ?? null,
      consultationId: command.consultationId ?? null,
      findings: command.findings ?? null,
      labels: command.labels ?? null,
      files: [],
      createdBy: command.createdBy,
    };

    return this.imagingRepo.create(data);
  }
}