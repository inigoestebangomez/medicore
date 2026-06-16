// apps/api/src/application/surgery/commands/soft-delete-surgery.use-case.spec.ts
import { SoftDeleteSurgeryUseCase } from './soft-delete-surgery.use-case';
import { ForbiddenError } from './update-surgery.use-case';
import { InMemorySurgeryRepository } from './in-memory-surgery.repository';
import { Surgery } from '@/domain/surgery/surgery.entity';
import { SurgeryNotFoundError } from '@/domain/surgery/errors/surgery-not-found.error';

describe('SoftDeleteSurgeryUseCase', () => {
  let useCase: SoftDeleteSurgeryUseCase;
  let repo: InMemorySurgeryRepository;

  const orgId = 'org-1';
  const patientId = 'patient-1';
  const physicianId = 'physician-1';
  const userId = 'physician-1';
  const otherUserId = 'physician-2';

  beforeEach(() => {
    repo = new InMemorySurgeryRepository();
    useCase = new SoftDeleteSurgeryUseCase(repo);
  });

  async function seedSurgery(overrides: Record<string, unknown> = {}): Promise<Surgery> {
    return repo.create({
      organizationId: orgId,
      patientId,
      date: new Date('2024-06-15'),
      status: 'SCHEDULED',
      physicianId,
      procedureType: 'Septoplastia bilateral',
      asa: 'ASA_II',
      createdBy: userId as string,
      ...overrides,
    });
  }

  it('should soft-delete surgery successfully', async () => {
    const surgery = await seedSurgery();

    const result = await useCase.execute({
      id: surgery.id,
      organizationId: orgId,
      role: 'OWNER',
      userId,
    });

    expect(result.deletedAt).not.toBeNull();
  });

  it('should throw SurgeryNotFoundError for missing ID', async () => {
    await expect(
      useCase.execute({
        id: 'nonexistent',
        organizationId: orgId,
        role: 'OWNER',
        userId,
      }),
    ).rejects.toThrow(SurgeryNotFoundError);
  });

  it('should allow PHYSICIAN to delete own surgery', async () => {
    const surgery = await seedSurgery();

    const result = await useCase.execute({
      id: surgery.id,
      organizationId: orgId,
      role: 'PHYSICIAN',
      userId,
    });

    expect(result.deletedAt).not.toBeNull();
  });

  it('should throw ForbiddenError when PHYSICIAN deletes another\'s surgery', async () => {
    const surgery = await seedSurgery();

    await expect(
      useCase.execute({
        id: surgery.id,
        organizationId: orgId,
        role: 'PHYSICIAN',
        userId: otherUserId,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('should allow OWNER to delete any surgery', async () => {
    const surgery = await seedSurgery();

    const result = await useCase.execute({
      id: surgery.id,
      organizationId: orgId,
      role: 'OWNER',
      userId: otherUserId,
    });

    expect(result.deletedAt).not.toBeNull();
  });
});