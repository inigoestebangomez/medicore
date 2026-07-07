// apps/api/src/api/imaging-studies/dto/upload-files.dto.ts
// DTO for the upload files response

export interface UploadFilesResponseDto {
  studyId: string;
  filesAdded: number;
  files: Array<{
    key: string;
    originalName: string;
    mimeType: string;
    size: number;
    uploadedAt: string;
  }>;
}

export interface PresignedUrlResponseDto {
  url: string;
  expiresAt: string;
}

export interface ImagingStudyResponseDto {
  id: string;
  organizationId: string;
  patientId: string;
  surgeryId: string | null;
  consultationId: string | null;
  type: string;
  date: string;
  description: string | null;
  findings: string | null;
  labels: Array<{ label: string; coordinates?: Record<string, unknown> }> | null;
  files: Array<{
    key: string;
    originalName: string;
    mimeType: string;
    size: number;
    uploadedAt: string;
  }>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ListImagingStudiesResponseDto {
  items: ImagingStudyResponseDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
