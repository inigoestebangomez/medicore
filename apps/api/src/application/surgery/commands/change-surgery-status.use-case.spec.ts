// apps/api/src/application/surgery/commands/change-surgery-status.use-case.spec.ts
import { ChangeSurgeryStatusUseCase } from './change-surgery-status.use-case';
import { InMemorySurgeryRepository } from './in-memory-surgery.repository';
import { ForbiddenError } from './update-surgery.use-case';
import { Surgery } from '@/domain/surgery/surgery.entity';
import { SurgeryNotFoundError } from '@/domain/surgery/errors/surgery-not-found.error';
import { InvalidSurgeryTransitionError } from '@/domain/surgery/errors/invalid-surgery-transition.error';
import { AsaRequiredError } from '@/domain/surgery/errors/asa-required.error';
import { DateInFutureError } from '@/domain/consultation/errors/date-in-future.error';

describe('ChangeSurgeryStatusUseCase', () => {
  let useCase: ChangeSurgeryStatusUseCase;
  let repo: InMemorySurgeryRepository;

  const orgId = 'org-1';
  const patientId = 'patient-1';
  const physicianId = 'physician-1';
  const userId = 'physician-1';
  const otherUserId = 'physician-2';

  beforeEach(() => {
    repo = new InMemorySurgeryRepository();
    useCase = new ChangeSurgeryStatusUseCase(repo);
  });

  async function seedSurgery(overrides: Record<string, unknown> = {}): Promise<Surgery> {
    return repo.create({
      organizationId: orgId,
      patientId,
      date: new Date('2024-06-15'),
      status: overrides.status as any ?? 'SCHEDULED',
      physicianId: overrides.physicianId as string ?? physicianId,
      procedureType: 'Septoplastia bilateral',
      asa: overrides.asa as string ?? 'ASA_II',
      createdBy: overrides.createdBy as string ?? userId,
      ...overrides,
    });
  }

  it('SCHEDULED → COMPLETED succeeds with ASA', async () => {
    const surgery = await seedSurgery();

    const result = await useCase.execute({
      id: surgery.id,
      organizationId: orgId,
      patientId,
      role: 'OWNER',
      userId,
      targetStatus: 'COMPLETED',
      asa: 'ASA_III',
      date: new Date(),
      statusReason: 'Surgery completed successfully',
    });

    expect(result).toBeDefined();
  });

  it('SCHEDULED → CANCELLED succeeds', async () => {
    const surgery = await seedSurgery();

    const result = await useCase.execute({
      id: surgery.id,
      organizationId: orgId,
      patientId,
      role: 'OWNER',
      userId,
      targetStatus: 'CANCELLED',
      statusReason: 'Patient unavailable',
    });

    expect(result).toBeDefined();
  });

  it('SCHEDULED → POSTPONED succeeds', async () => {
    const surgery = await seedSurgery();

    const result = await useCase.execute({
      id: surgery.id,
      organizationId: orgId,
      patientId,
      role: 'OWNER',
      userId,
      targetStatus: 'POSTPONED',
      statusReason: 'Room unavailable',
    });

    expect(result).toBeDefined();
  });

  it('POSTPONED → SCHEDULED succeeds', async () => {
    const surgery = await seedSurgery({ status: 'POSTPONED' });

    const result = await useCase.execute({
      id: surgery.id,
      organizationId: orgId,
      patientId,
      role: 'OWNER',
      userId,
      targetStatus: 'SCHEDULED',
    });

    expect(result).toBeDefined();
  });

  it('COMPLETED → SCHEDULED fails (InvalidSurgeryTransitionError)', async () => {
    const surgery = await seedSurgery({ status: 'COMPLETED' });

    await expect(
      useCase.execute({
        id: surgery.id,
        organizationId: orgId,
        patientId,
        role: 'OWNER',
        userId,
        targetStatus: 'SCHEDULED',
      }),
    ).rejects.toThrow(InvalidSurgeryTransitionError);
  });

  it('CANCELLED → SCHEDULED fails (InvalidSurgeryTransitionError)', async () => {
    const surgery = await seedSurgery({ status: 'CANCELLED' });

    await expect(
      useCase.execute({
        id: surgery.id,
        organizationId: orgId,
        patientId,
        role: 'OWNER',
        userId,
        targetStatus: 'SCHEDULED',
      }),
    ).rejects.toThrow(InvalidSurgeryTransitionError);
  });

  it('COMPLETED transition without ASA throws AsaRequiredError', async () => {
    const surgery = await seedSurgery({ asa: null });

    await expect(
      useCase.execute({
        id: surgery.id,
        organizationId: orgId,
        patientId,
        role: 'OWNER',
        userId,
        targetStatus: 'COMPLETED',
        date: new Date(),
      }),
    ).rejects.toThrow(AsaRequiredError);
  });

  it('COMPLETED transition with future date throws DateInFutureError', async () => {
    const surgery = await seedSurgery();
    const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await expect(
      useCase.execute({
        id: surgery.id,
        organizationId: orgId,
        patientId,
        role: 'OWNER',
        userId,
        targetStatus: 'COMPLETED',
        asa: 'ASA_II',
        date: futureDate,
      }),
    ).rejects.toThrow(DateInFutureError);
  });

  it('PHYSICIAN ownership check enforced', async () => {
    const surgery = await seedSurgery();

    await expect(
      useCase.execute({
        id: surgery.id,
        organizationId: orgId,
        patientId,
        role: 'PHYSICIAN',
        userId: otherUserId,
        targetStatus: 'COMPLETED',
        asa: 'ASA_II',
        date: new Date(),
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('should throw SurgeryNotFoundError for missing ID', async () => {
    await expect(
      useCase.execute({
        id: 'nonexistent',
        organizationId: orgId,
        patientId,
        role: 'OWNER',
        userId,
        targetStatus: 'COMPLETED',
        asa: 'ASA_II',
        date: new Date(),
      }),
    ).rejects.toThrow(SurgeryNotFoundError);
  });

  it('should allow COMPLETED using existing ASA when not provided in command', async () => {
    const surgery = await seedSurgery({ asa: 'ASA_II' });

    // Surgery already has ASA_II, so command doesn't need to provide it
    const result = await useCase.execute({
      id: surgery.id,
      organizationId: orgId,
      patientId,
      role: 'OWNER',
      userId,
      targetStatus: 'COMPLETED',
      date: new Date(),
    });

    expect(result).toBeDefined();
  });
});