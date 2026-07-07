// apps/api/src/infrastructure/queues/dicom-metadata.processor.ts
// BR-IMG-006: DICOM metadata extraction worker
// Reads first ~64KB of file from R2, parses DICOM headers, updates findings.
// Patient identity fields are ignored — the patient is referenced by patientId.

import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bullmq';
import { Inject, Injectable } from '@nestjs/common';
import type { IStorageService } from '@/domain/shared/storage.interface';
import type { IImagingStudyRepository } from '@/domain/imaging/imaging-study.repository.interface';


interface DicomJobData {
  studyId: string;
  organizationId: string;
  fileKey: string;
}

@Injectable()
@Processor('imaging')
export class DicomMetadataProcessor {
  constructor(
    @Inject('IStorageService') private readonly storageService: IStorageService,
    @Inject('IImagingStudyRepository') private readonly imagingRepo: IImagingStudyRepository,
  ) {}

  @Process('extract-dicom')
  async handleExtractMetadata(job: Job<DicomJobData>): Promise<void> {
    const { studyId, organizationId, fileKey } = job.data;

    try {
      // Read first ~64KB from R2 via presigned URL
      const presigned = await this.storageService.getPresignedUrl(fileKey, 5);

      const response = await fetch(presigned.url, {
        headers: { Range: 'bytes=0-65536' },
      });

      if (!response.ok) {
        console.error(`[DicomMetadataProcessor] Failed to fetch file ${fileKey}: ${response.status}`);
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Parse DICOM metadata using dicom-parser
      const dicomParser = await import('dicom-parser');
      const byteArray = new Uint8Array(buffer);
      const dataSet = dicomParser.parseDicom(byteArray);

      // Extract technical metadata only (BR-IMG-006: ignore patient identity)
      const modality = dataSet.string('x00080060') ?? '';
      const studyDate = dataSet.string('x00080020') ?? '';
      const seriesDescription = dataSet.string('x0008103e') ?? '';
      const manufacturer = dataSet.string('x00080070') ?? '';
      const institutionName = dataSet.string('x00080080') ?? '';

      const metadata: Record<string, string> = {};
      if (modality) metadata.modality = modality;
      if (studyDate) metadata.studyDate = studyDate;
      if (seriesDescription) metadata.seriesDescription = seriesDescription;
      if (manufacturer) metadata.manufacturer = manufacturer;
      if (institutionName) metadata.institutionName = institutionName;

      // Update findings on the study
      const study = await this.imagingRepo.findById(studyId, organizationId);
      if (!study) {
        console.error(`[DicomMetadataProcessor] Study ${studyId} not found`);
        return;
      }

      const existingFindings = study.findings ?? '';
      const metadataStr = Object.entries(metadata)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');

      const newFindings = existingFindings
        ? `${existingFindings}\n\n--- DICOM Metadata ---\n${metadataStr}`
        : `--- DICOM Metadata ---\n${metadataStr}`;

      await this.imagingRepo.update(studyId, organizationId, {
        findings: newFindings,
        updatedBy: 'system',
      });

    } catch (error: any) {
      // BR-IMG-006: Handle DICOM parse failure gracefully — don't crash
      console.error(`[DicomMetadataProcessor] Error processing DICOM for study ${studyId}:`, error?.message ?? error);
    }
  }
}