// apps/api/src/application/imaging/commands/upload-files.use-case.ts
// BR-IMG-001: MIME validation (in FileValidationPipe, not here)
// BR-IMG-002: File size validation (in FileValidationPipe, not here)
// BR-IMG-003: File count validation (in FileValidationPipe, not here)
// BR-IMG-005: Upload to R2, append metadata, enqueue DICOM job if applicable

import type { IImagingStudyRepository } from '@/domain/imaging/imaging-study.repository.interface';
import type { IStorageService } from '@/domain/shared/storage.interface';
import type { FileMetadataEntry } from '@/domain/imaging/imaging-study.entity';
import { ImagingStudyNotFoundError } from '@/domain/imaging/errors/imaging-study-not-found.error';
import { assertValidImagingStudyId } from '@/domain/imaging/imaging-study-id';

export interface UploadFileEntry {
  originalName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}

export interface UploadFilesCommand {
  studyId: string;
  organizationId: string;
  patientId: string;
  files: UploadFileEntry[];
}

export interface UploadFilesResult {
  studyId: string;
  filesAdded: number;
  files: FileMetadataEntry[];
}

export class UploadFilesUseCase {
  constructor(
    private readonly imagingRepo: IImagingStudyRepository,
    private readonly storageService: IStorageService,
    private readonly dicomQueue?: { add: (name: string, data: Record<string, string>) => Promise<unknown> },
  ) {}

  async execute(command: UploadFilesCommand): Promise<UploadFilesResult> {
    const { studyId, organizationId, patientId } = command;
    assertValidImagingStudyId(studyId);

    // Fetch existing study
    const existing = await this.imagingRepo.findById(studyId, organizationId);
    if (!existing) {
      throw new ImagingStudyNotFoundError(studyId);
    }

    const uploadedFiles: FileMetadataEntry[] = [];
    const timestamp = Date.now();

    // Upload each file to R2
    for (const file of command.files) {
      const key = `${organizationId}/${patientId}/imaging/${studyId}/${timestamp}-${file.originalName}`;
      const isMultipart = file.size >= 5 * 1024 * 1024; // 5MB threshold

      if (isMultipart) {
        await this.storageService.uploadMultipart(key, file.buffer, { contentType: file.mimeType });
      } else {
        await this.storageService.upload(key, file.buffer, { contentType: file.mimeType });
      }

      const metadata: FileMetadataEntry = {
        key,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };
      uploadedFiles.push(metadata);

      // Enqueue DICOM metadata extraction if applicable
      if (file.mimeType === 'application/dicom' && this.dicomQueue) {
        await this.dicomQueue.add('extract-dicom', {
          studyId,
          organizationId,
          fileKey: key,
        });
      }
    }

    // Append file metadata to study
    await this.imagingRepo.appendFiles(studyId, organizationId, uploadedFiles);

    return {
      studyId,
      filesAdded: uploadedFiles.length,
      files: uploadedFiles,
    };
  }
}
