// apps/api/src/api/imaging-studies/pipes/file-validation.pipe.ts
// BR-IMG-001: MIME type validation
// BR-IMG-002: File size limits per MIME type
// BR-IMG-003: File count limit per study (max 100)

import { PipeTransform, UnprocessableEntityException } from '@nestjs/common';
import { FileCountExceededError } from '@/domain/imaging/errors/file-count-exceeded.error';
import { FileTooLargeError } from '@/domain/imaging/errors/file-too-large.error';
import { InvalidMimeTypeError } from '@/domain/imaging/errors/invalid-mime-type.error';

// BR-IMG-001: Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/dicom',
  'video/mp4',
  'video/quicktime',
  'application/pdf',
  'application/zip',
] as const;

// BR-IMG-002: Size limits per MIME type (in bytes)
const SIZE_LIMITS: Record<string, number> = {
  'image/jpeg': 50 * 1024 * 1024,       // 50 MB
  'image/png': 50 * 1024 * 1024,         // 50 MB
  'image/webp': 50 * 1024 * 1024,        // 50 MB
  'application/dicom': 200 * 1024 * 1024, // 200 MB
  'video/mp4': 500 * 1024 * 1024,         // 500 MB
  'video/quicktime': 500 * 1024 * 1024,   // 500 MB
  'application/pdf': 25 * 1024 * 1024,    // 25 MB
  'application/zip': 500 * 1024 * 1024,   // 500 MB
};

// BR-IMG-003: Max files per study
const MAX_FILES_PER_STUDY = 100;

export interface ValidatedFile {
  originalName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}

export class FileValidationPipe implements PipeTransform {
  constructor(private readonly existingFileCount: number = 0) {}

  transform(files: Express.Multer.File | Express.Multer.File[]): ValidatedFile[] {
    const fileArray = Array.isArray(files) ? files : [files];

    if (!fileArray || fileArray.length === 0) {
      throw new UnprocessableEntityException('No files provided');
    }

    // BR-IMG-003: Check file count limit
    if (this.existingFileCount + fileArray.length > MAX_FILES_PER_STUDY) {
      throw new UnprocessableEntityException(
        new FileCountExceededError(this.existingFileCount, fileArray.length, MAX_FILES_PER_STUDY).message,
      );
    }

    const validatedFiles: ValidatedFile[] = [];

    for (const file of fileArray) {
      // BR-IMG-001: Validate MIME type
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype as any)) {
        throw new UnprocessableEntityException(
          {
            statusCode: 422,
            error: 'INVALID_MIME_TYPE',
            message: new InvalidMimeTypeError(file.mimetype, [...ALLOWED_MIME_TYPES]).message,
            details: [{ fileName: file.originalname, mimeType: file.mimetype, allowed: [...ALLOWED_MIME_TYPES] }],
          },
        );
      }

      // BR-IMG-002: Validate file size
      const maxSize = SIZE_LIMITS[file.mimetype] ?? 0;
      if (file.size > maxSize) {
        throw new UnprocessableEntityException(
          {
            statusCode: 422,
            error: 'FILE_TOO_LARGE',
            message: new FileTooLargeError(file.originalname, file.size, maxSize).message,
            details: [{ fileName: file.originalname, size: file.size, maxSize }],
          },
        );
      }

      validatedFiles.push({
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      });
    }

    return validatedFiles;
  }
}
