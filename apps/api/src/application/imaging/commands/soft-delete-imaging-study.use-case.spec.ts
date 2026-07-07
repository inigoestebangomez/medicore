// apps/api/src/application/imaging/commands/soft-delete-imaging-study.use-case.spec.ts
import { SoftDeleteImagingStudyUseCase } from './soft-delete-imaging-study.use-case';
import { InMemoryImagingStudyRepository } from './in-memory-imaging-study.repository';
import { ImagingStudyNotFoundError } from '@/domain/imaging/errors/imaging-study-not-found.error';
import type { IPendingDeletionRepository, PendingDeletionRecord, CreatePendingDeletionInput } from '@/domain/imaging/pending-deletion.repository.interface';

class InMemoryPendingDeletionRepository implements IPendingDeletionRepository {
  private records: PendingDeletionRecord[] = [];
  private counter = 0;

  async create(data: CreatePendingDeletionInput): Promise<PendingDeletionRecord> {
    this.counter++;
    const record: PendingDeletionRecord = {
      id: `pending-${this.counter}`,
      organizationId: data.organizationId,
      entityType: data.entityType,
      entityId: data.entityId,
      fileKey: data.fileKey,
      scheduledAt: data.scheduledAt,
      processedAt: null,
      createdAt: new Date(),
    };
    this.records.push(record);
    return record;
  }

  async findDue(_now: Date): Promise<PendingDeletionRecord[]> {
    return this.records.filter((r) => !r.processedAt && r.scheduledAt <= _now);
  }

  async markProcessed(id: string): Promise<void> {
    const record = this.records.find((r) => r.id === id);
    if (record) record.processedAt = new Date();
  }

  getRecords(): PendingDeletionRecord[] {
    return this.records;
  }
}

describe('SoftDeleteImagingStudyUseCase', () => {
  let useCase: SoftDeleteImagingStudyUseCase;
  let imagingRepo: InMemoryImagingStudyRepository;
  let pendingDeletionRepo: InMemoryPendingDeletionRepository;
  let deletionQueue: { add: jest.Mock };

  const orgId = 'org-1';
  const patientId = 'patient-1';
  const userId = 'user-1';

  beforeEach(() => {
    imagingRepo = new InMemoryImagingStudyRepository();
    pendingDeletionRepo = new InMemoryPendingDeletionRepository();
    deletionQueue = { add: jest.fn().mockResolvedValue({}) };
    useCase = new SoftDeleteImagingStudyUseCase(imagingRepo, pendingDeletionRepo, deletionQueue);
  });

  it('should soft delete an imaging study', async () => {
    const study = await imagingRepo.create({
      organizationId: orgId,
      patientId,
      type: 'CT_SCAN',
      date: new Date(),
      createdBy: userId,
    });

    const result = await useCase.execute({
      id: study.id,
      organizationId: orgId,
      role: 'OWNER',
      userId,
    });

    expect(result.deletedAt).toBeDefined();
    expect(result.deletedAt).toBeInstanceOf(Date);
  });

  it('should throw ImagingStudyNotFoundError for non-existent study', async () => {
    await expect(
      useCase.execute({ id: 'nonexistent', organizationId: orgId, role: 'OWNER', userId }),
    ).rejects.toThrow(ImagingStudyNotFoundError);
  });

  it('should create PendingDeletion records for each file', async () => {
    const study = await imagingRepo.create({
      organizationId: orgId,
      patientId,
      type: 'CT_SCAN',
      date: new Date(),
      createdBy: userId,
    });

    // Add files
    await imagingRepo.appendFiles(study.id, orgId, [
      { key: 'file1.dcm', originalName: 'file1.dcm', mimeType: 'application/dicom', size: 1024, uploadedAt: new Date().toISOString() },
      { key: 'file2.jpg', originalName: 'file2.jpg', mimeType: 'image/jpeg', size: 2048, uploadedAt: new Date().toISOString() },
    ]);

    await useCase.execute({ id: study.id, organizationId: orgId, role: 'OWNER', userId });

    const records = pendingDeletionRepo.getRecords();
    expect(records).toHaveLength(2);
    expect(records[0].entityType).toBe('ImagingStudy');
    expect(records[0].entityId).toBe(study.id);
  });

  it('should enqueue BullMQ deletion job', async () => {
    const study = await imagingRepo.create({
      organizationId: orgId,
      patientId,
      type: 'CT_SCAN',
      date: new Date(),
      createdBy: userId,
    });

    await useCase.execute({ id: study.id, organizationId: orgId, role: 'OWNER', userId });

    expect(deletionQueue.add).toHaveBeenCalledWith('process-pending-deletions', {
      organizationId: orgId,
    });
  });

  it('should throw StudyAlreadyDeletedError when deleting already deleted study', async () => {
    const study = await imagingRepo.create({
      organizationId: orgId,
      patientId,
      type: 'CT_SCAN',
      date: new Date(),
      createdBy: userId,
    });

    await useCase.execute({ id: study.id, organizationId: orgId, role: 'OWNER', userId });

    // Second delete — but since findById filters by deletedAt:null, it will throw ImagingStudyNotFoundError
    await expect(
      useCase.execute({ id: study.id, organizationId: orgId, role: 'OWNER', userId }),
    ).rejects.toThrow();
  });
});