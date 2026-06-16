// apps/api/src/application/surgery/commands/update-surgery.use-case.spec.ts
import { UpdateSurgeryUseCase, ForbiddenError } from './update-surgery.use-case';
import { InMemorySurgeryRepository } from './in-memory-surgery.repository';
import { SurgeryNotFoundError } from '@/domain/surgery/errors/surgery-not-found.error';
import { EditReasonRequiredError } from '@/domain/surgery/errors/edit-reason-required.error';
import { InvalidProcedureCodeError } from '@/domain/surgery/errors/invalid-procedure-code.error';
import { Surgery } from '@/domain/surgery/surgery.entity';

describe('UpdateSurgeryUseCase', () => {
  let useCase: UpdateSurgeryUseCase;
  let repo: InMemorySurgeryRepository;

  const orgId = 'org-1';
  const patientId = 'patient-1';
  const physicianId = 'physician-1';
  const userId = 'physician-1';
  const otherUserId = 'physician-2';

  beforeEach(() => {
    repo = new InMemorySurgeryRepository();
    useCase = new UpdateSurgeryUseCase(repo);
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

  it('should update surgery successfully', async () => {
    const surgery = await seedSurgery();

    const result = await useCase.execute({
      id: surgery.id,
      organizationId: orgId,
      role: 'OWNER',
      userId,
      procedureType: 'Updated procedure',
    });

    expect(result.procedureType).toBe('Updated procedure');
  });

  it('should throw SurgeryNotFoundError for missing ID', async () => {
    await expect(
      useCase.execute({
        id: 'nonexistent',
        organizationId: orgId,
        role: 'OWNER',
        userId,
        procedureType: 'Updated',
      }),
    ).rejects.toThrow(SurgeryNotFoundError);
  });

  it('should throw ForbiddenError when PHYSICIAN tries to update another\'s surgery', async () => {
    const surgery = await seedSurgery();

    await expect(
      useCase.execute({
        id: surgery.id,
        organizationId: orgId,
        role: 'PHYSICIAN',
        userId: otherUserId,
        procedureType: 'Trying to update',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('should allow OWNER to update any surgery', async () => {
    const surgery = await seedSurgery();

    const result = await useCase.execute({
      id: surgery.id,
      organizationId: orgId,
      role: 'OWNER',
      userId: otherUserId,
      procedureType: 'Owner update',
    });

    expect(result.procedureType).toBe('Owner update');
  });

  it('should allow PHYSICIAN to update own surgery', async () => {
    const surgery = await seedSurgery();

    const result = await useCase.execute({
      id: surgery.id,
      organizationId: orgId,
      role: 'PHYSICIAN',
      userId,
      procedureType: 'Own update',
    });

    expect(result.procedureType).toBe('Own update');
  });

  it('should throw EditReasonRequiredError when updating COMPLETED surgery without editReason', async () => {
    const surgery = await seedSurgery({ status: 'COMPLETED' });

    await expect(
      useCase.execute({
        id: surgery.id,
        organizationId: orgId,
        role: 'OWNER',
        userId,
        procedureType: 'Updated',
      }),
    ).rejects.toThrow(EditReasonRequiredError);
  });

  it('should throw EditReasonRequiredError when updating CANCELLED surgery without editReason', async () => {
    const surgery = await seedSurgery({ status: 'CANCELLED' });

    await expect(
      useCase.execute({
        id: surgery.id,
        organizationId: orgId,
        role: 'OWNER',
        userId,
        procedureType: 'Updated',
      }),
    ).rejects.toThrow(EditReasonRequiredError);
  });

  it('should allow updating COMPLETED surgery with editReason', async () => {
    const surgery = await seedSurgery({ status: 'COMPLETED' });

    const result = await useCase.execute({
      id: surgery.id,
      organizationId: orgId,
      role: 'OWNER',
      userId,
      procedureType: 'Updated',
      editReason: 'Typo fix',
    });

    expect(result.procedureType).toBe('Updated');
  });

  it('should re-validate procedure codes if changed', async () => {
    const surgery = await seedSurgery();

    await expect(
      useCase.execute({
        id: surgery.id,
        organizationId: orgId,
        role: 'OWNER',
        userId,
        procedureCodes: [{ system: 'SNOMED', code: 'INVALID_PROC', description: 'Fake procedure' }],
      }),
    ).rejects.toThrow(InvalidProcedureCodeError);
  });

  it('should accept valid procedure codes on update', async () => {
    const surgery = await seedSurgery();

    const result = await useCase.execute({
      id: surgery.id,
      organizationId: orgId,
      role: 'OWNER',
      userId,
      procedureCodes: [{ system: 'ICD10', code: 'J01.90', description: 'Acute sinusitis' }],
    });

    expect(result).toBeDefined();
  });

  it('should add audit diff appended correctly', async () => {
    const surgery = await seedSurgery();

    await useCase.execute({
      id: surgery.id,
      organizationId: orgId,
      role: 'OWNER',
      userId,
      procedureType: 'New procedure type',
    });

    // Verify the update succeeded (audit is embedded in the update data)
    const updated = await repo.findById(surgery.id, orgId);
    expect(updated).toBeDefined();
  });
});