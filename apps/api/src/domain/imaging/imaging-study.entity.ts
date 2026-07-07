// apps/api/src/domain/imaging/imaging-study.entity.ts
// Domain entity: ImagingStudy — file metadata, soft delete, update diff

import type { ImagingStudyType } from '@medicore/contracts';

export interface FileMetadataEntry {
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface LabelEntry {
  label: string;
  coordinates?: Record<string, unknown>;
}

export interface ImagingStudyProps {
  id: string;
  organizationId: string;
  patientId: string;
  surgeryId?: string | null;
  consultationId?: string | null;
  type: ImagingStudyType;
  date: Date;
  description?: string | null;
  findings?: string | null;
  labels?: LabelEntry[] | null;
  files: FileMetadataEntry[];
  createdBy: string;
  updatedBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export class ImagingStudy {
  readonly id: string;
  readonly organizationId: string;
  readonly patientId: string;
  readonly surgeryId: string | null;
  readonly consultationId: string | null;
  readonly type: ImagingStudyType;
  readonly date: Date;
  readonly description: string | null;
  readonly findings: string | null;
  readonly labels: LabelEntry[] | null;
  readonly files: FileMetadataEntry[];
  readonly createdBy: string;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  constructor(props: ImagingStudyProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.patientId = props.patientId;
    this.surgeryId = props.surgeryId ?? null;
    this.consultationId = props.consultationId ?? null;
    this.type = props.type;
    this.date = props.date;
    this.description = props.description ?? null;
    this.findings = props.findings ?? null;
    this.labels = props.labels ?? null;
    this.files = props.files ?? [];
    this.createdBy = props.createdBy;
    this.updatedBy = props.updatedBy ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    this.deletedAt = props.deletedAt ?? null;
  }

  /**
   * Add file metadata entries to this study. Returns a new ImagingStudy.
   */
  addFileMetadata(files: FileMetadataEntry[]): ImagingStudy {
    return new ImagingStudy({
      ...this,
      files: [...this.files, ...files],
      updatedAt: new Date(),
    });
  }

  /**
   * Compute the diff for an update, producing per-field change entries.
   */
  diffForUpdate(
    newProps: Partial<Omit<ImagingStudyProps, 'id' | 'organizationId' | 'patientId' | 'createdBy' | 'createdAt' | 'files'>>,
    _userId: string,
  ): { field: string; from: unknown; to: unknown }[] {
    const fieldDiffs: { field: string; from: unknown; to: unknown }[] = [];
    const trackedFields = ['type', 'date', 'description', 'findings', 'labels', 'surgeryId', 'consultationId'] as const;

    for (const field of trackedFields) {
      const newVal = (newProps as any)[field];
      if (newVal !== undefined) {
        const oldVal = (this as any)[field];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          fieldDiffs.push({ field, from: oldVal, to: newVal ?? null });
        }
      }
    }

    return fieldDiffs;
  }

  /**
   * Soft delete: sets deletedAt to current timestamp. Returns a new ImagingStudy.
   */
  softDelete(): ImagingStudy {
    return new ImagingStudy({ ...this, deletedAt: new Date() });
  }
}