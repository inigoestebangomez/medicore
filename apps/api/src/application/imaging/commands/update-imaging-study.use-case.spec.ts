// apps/api/src/application/imaging/commands/update-imaging-study.use-case.spec.ts
import { UpdateImagingStudyUseCase } from './update-imaging-study.use-case';
import { InMemoryImagingStudyRepository } from './in-memory-imaging-study.repository';
import { ImagingStudyNotFoundError } from '@/domain/imaging/errors/imaging-study-not-found.error';
import { ForbiddenError } from './update-imaging-study.use-case';

describe('UpdateImagingStudyUseCase', () => {
  let useCase: UpdateImagingStudyUseCase;
  let imagingRepo: InMemoryImagingStudyRepository;

  const orgId = 'org-1';
  const patientId = 'patient-1';
  const userId = 'user-1';

  beforeEach(() => {
    imagingRepo = new InMemoryImagingStudyRepository();
    useCase = new UpdateImagingStudyUseCase(imagingRepo);
  });

  it('should update findings successfully', async () => {
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
      findings: 'Updated findings',
    });

    expect(result.findings).toBe('Updated findings');
  });

  it('should throw ImagingStudyNotFoundError for non-existent study', async () => {
    await expect(
      useCase.execute({ id: 'nonexistent', organizationId: orgId, role: 'OWNER', userId, findings: 'test' }),
    ).rejects.toThrow(ImagingStudyNotFoundError);
  });

  it('should throw ForbiddenError when PHYSICIAN updates another study', async () => {
    const study = await imagingRepo.create({
      organizationId: orgId,
      patientId,
      type: 'CT_SCAN',
      date: new Date(),
      createdBy: 'other-user',
    });

    await expect(
      useCase.execute({ id: study.id, organizationId: orgId, role: 'PHYSICIAN', userId, findings: 'test' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('should allow OWNER to update any study', async () => {
    const study = await imagingRepo.create({
      organizationId: orgId,
      patientId,
      type: 'CT_SCAN',
      date: new Date(),
      createdBy: 'other-user',
    });

    const result = await useCase.execute({
      id: study.id,
      organizationId: orgId,
      role: 'OWNER',
      userId,
      findings: 'Owner update',
    });

    expect(result.findings).toBe('Owner update');
  });
});