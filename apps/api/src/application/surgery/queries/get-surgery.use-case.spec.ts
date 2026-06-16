// apps/api/src/application/surgery/queries/get-surgery.use-case.spec.ts
import { GetSurgeryUseCase } from './get-surgery.use-case';
import { InMemorySurgeryRepository } from '../commands/in-memory-surgery.repository';
import { SurgeryNotFoundError } from '@/domain/surgery/errors/surgery-not-found.error';

describe('GetSurgeryUseCase', () => {
  let useCase: GetSurgeryUseCase;
  let repo: InMemorySurgeryRepository;

  const orgId = 'org-1';

  beforeEach(() => {
    repo = new InMemorySurgeryRepository();
    useCase = new GetSurgeryUseCase(repo);
  });

  it('should return surgery when found', async () => {
    const created = await repo.create({
      organizationId: orgId,
      patientId: 'patient-1',
      date: new Date('2024-06-15'),
      status: 'SCHEDULED',
      physicianId: 'physician-1',
      procedureType: 'Septoplastia bilateral',
      asa: 'ASA_II',
      createdBy: 'user-1',
    });

    const result = await useCase.execute({
      id: created.id,
      organizationId: orgId,
    });

    expect(result).toBeDefined();
    expect(result.id).toBe(created.id);
    expect(result.procedureType).toBe('Septoplastia bilateral');
  });

  it('should throw SurgeryNotFoundError when not found', async () => {
    await expect(
      useCase.execute({ id: 'nonexistent', organizationId: orgId }),
    ).rejects.toThrow(SurgeryNotFoundError);
  });
});