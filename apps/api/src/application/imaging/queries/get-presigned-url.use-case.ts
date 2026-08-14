// apps/api/src/application/imaging/queries/get-presigned-url.use-case.ts
// BR-IMG-004: Presigned URL generation with 15-minute TTL
// BR-IMG-006: Only READ_IMAGING permission holders can access (enforced by controller RBAC)
// BR-TRX-001: Organization isolation — verify study belongs to user's org

import type { IImagingStudyRepository } from '@/domain/imaging/imaging-study.repository.interface';
import type { IStorageService, PresignedUrlResult } from '@/domain/shared/storage.interface';
import { ImagingStudyNotFoundError } from '@/domain/imaging/errors/imaging-study-not-found.error';
import { assertValidImagingStudyId } from '@/domain/imaging/imaging-study-id';

export interface GetPresignedUrlQuery {
  studyId: string;
  organizationId: string;
  fileKey: string;
}

export class GetPresignedUrlUseCase {
  constructor(
    private readonly imagingRepo: IImagingStudyRepository,
    private readonly storageService: IStorageService,
  ) {}

  async execute(query: GetPresignedUrlQuery): Promise<PresignedUrlResult> {
    const { studyId, organizationId, fileKey } = query;
    assertValidImagingStudyId(studyId);

    // Fetch study and verify org ownership
    const study = await this.imagingRepo.findById(studyId, organizationId);
    if (!study) {
      throw new ImagingStudyNotFoundError(studyId);
    }

    // Verify file belongs to this study
    const fileExists = study.files.some((f) => f.key === fileKey);
    if (!fileExists) {
      throw new ImagingStudyNotFoundError(studyId);
    }

    // Generate presigned URL with 15-minute TTL (BR-IMG-004)
    return this.storageService.getPresignedUrl(fileKey, 15);
  }
}
