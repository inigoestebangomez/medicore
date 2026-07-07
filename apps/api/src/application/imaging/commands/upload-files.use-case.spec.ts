// apps/api/src/application/imaging/commands/upload-files.use-case.spec.ts
import { UploadFilesUseCase } from './upload-files.use-case';
import { InMemoryImagingStudyRepository } from './in-memory-imaging-study.repository';
import type { IStorageService } from '@/domain/shared/storage.interface';
import { ImagingStudyNotFoundError } from '@/domain/imaging/errors/imaging-study-not-found.error';

class MockStorageService implements IStorageService {
  async upload(key: string, _data: Buffer, _metadata?: Record<string, string>) {
    return { key, size: _data.length, etag: 'mock-etag' };
  }
  async uploadMultipart(key: string, data: Buffer, _metadata?: Record<string, string>, _chunkSize?: number) {
    return { key, size: data.length };
  }
  async getPresignedUrl(_key: string, _ttlMinutes?: number) {
    return { url: 'https://r2.example.com/presigned', expiresAt: new Date() };
  }
  async delete(_key: string) {}
}

describe('UploadFilesUseCase', () => {
  let useCase: UploadFilesUseCase;
  let imagingRepo: InMemoryImagingStudyRepository;
  let storageService: MockStorageService;
  let dicomQueue: { add: jest.Mock };

  const orgId = 'org-1';
  const patientId = 'patient-1';
  const userId = 'user-1';

  beforeEach(() => {
    imagingRepo = new InMemoryImagingStudyRepository();
    storageService = new MockStorageService();
    dicomQueue = { add: jest.fn().mockResolvedValue({}) };
    useCase = new UploadFilesUseCase(imagingRepo, storageService, dicomQueue);
  });

  it('should upload a single file successfully', async () => {
    const study = await imagingRepo.create({
      organizationId: orgId,
      patientId,
      type: 'CT_SCAN',
      date: new Date(),
      createdBy: userId,
    });

    const result = await useCase.execute({
      studyId: study.id,
      organizationId: orgId,
      patientId,
      files: [
        { originalName: 'photo.jpg', mimeType: 'image/jpeg', size: 1024, buffer: Buffer.from('jpg-data') },
      ],
    });

    expect(result.filesAdded).toBe(1);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].originalName).toBe('photo.jpg');
    expect(result.files[0].mimeType).toBe('image/jpeg');
  });

  it('should upload multiple files atomically', async () => {
    const study = await imagingRepo.create({
      organizationId: orgId,
      patientId,
      type: 'MRI',
      date: new Date(),
      createdBy: userId,
    });

    const result = await useCase.execute({
      studyId: study.id,
      organizationId: orgId,
      patientId,
      files: [
        { originalName: 'scan1.dcm', mimeType: 'application/dicom', size: 2048, buffer: Buffer.from('dcm-1') },
        { originalName: 'scan2.png', mimeType: 'image/png', size: 4096, buffer: Buffer.from('png-2') },
      ],
    });

    expect(result.filesAdded).toBe(2);
    expect(result.files).toHaveLength(2);
  });

  it('should enqueue DICOM job for DICOM files', async () => {
    const study = await imagingRepo.create({
      organizationId: orgId,
      patientId,
      type: 'CT_SCAN',
      date: new Date(),
      createdBy: userId,
    });

    await useCase.execute({
      studyId: study.id,
      organizationId: orgId,
      patientId,
      files: [
        { originalName: 'dicom.dcm', mimeType: 'application/dicom', size: 2048, buffer: Buffer.from('dcm-data') },
      ],
    });

    expect(dicomQueue.add).toHaveBeenCalledWith('extract-dicom', expect.objectContaining({
      studyId: study.id,
      organizationId: orgId,
    }));
  });

  it('should NOT enqueue DICOM job for non-DICOM files', async () => {
    const study = await imagingRepo.create({
      organizationId: orgId,
      patientId,
      type: 'XRAY',
      date: new Date(),
      createdBy: userId,
    });

    await useCase.execute({
      studyId: study.id,
      organizationId: orgId,
      patientId,
      files: [
        { originalName: 'xray.jpg', mimeType: 'image/jpeg', size: 1024, buffer: Buffer.from('jpg-data') },
      ],
    });

    expect(dicomQueue.add).not.toHaveBeenCalled();
  });

  it('should throw ImagingStudyNotFoundError for non-existent study', async () => {
    await expect(
      useCase.execute({
        studyId: 'nonexistent',
        organizationId: orgId,
        patientId,
        files: [
          { originalName: 'test.jpg', mimeType: 'image/jpeg', size: 1024, buffer: Buffer.from('data') },
        ],
      }),
    ).rejects.toThrow(ImagingStudyNotFoundError);
  });
});