// apps/api/src/application/patient/commands/soft-delete-patient.use-case.spec.ts
import { SoftDeletePatientUseCase } from './soft-delete-patient.use-case';
import { InMemoryPatientRepository } from '@/infrastructure/database/repositories/in-memory-patient.repository';
import { Patient } from '@/domain/patient/patient.entity';
import { PatientNotFoundError } from '@/domain/patient/errors/patient-not-found.error';
import { ScheduledSurgeryBlocksDeleteError } from '@/domain/patient/errors/scheduled-surgery-blocks-delete.error';

describe('SoftDeletePatientUseCase', () => {
  let useCase: SoftDeletePatientUseCase;
  let repo: InMemoryPatientRepository;

  const orgId = 'org-1';
  const userId = 'user-1';

  beforeEach(() => {
    repo = new InMemoryPatientRepository();
    useCase = new SoftDeletePatientUseCase(repo);
  });

  async function seedPatient(overrides: Record<string, unknown> = {}): Promise<Patient> {
    return repo.create({
      nhc: await repo.getNextNhcSequence(orgId),
      firstName: 'María',
      lastName: 'García López',
      birthDate: new Date('1984-03-12'),
      sex: 'FEMALE',
      phone: '+34612345678',
      email: 'maria@example.com',
      idDocument: '12345678A',
      idDocType: 'DNI',
      bloodType: 'A_POS',
      notes: 'Patient notes',
      organizationId: orgId,
      createdBy: userId,
      ...overrides,
    });
  }

  it('should soft-delete patient (set deletedAt)', async () => {
    const patient = await seedPatient();
    expect(patient.deletedAt).toBeNull();

    const result = await useCase.execute({
      id: patient.id,
      organizationId: orgId,
    });

    expect(result.deletedAt).not.toBeNull();
    expect(result.deletedAt instanceof Date).toBe(true);
  });

  it('should throw PatientNotFoundError for missing patient', async () => {
    await expect(
      useCase.execute({
        id: 'nonexistent-id',
        organizationId: orgId,
      }),
    ).rejects.toThrow(PatientNotFoundError);
  });

  describe('BR-PAT-005: Scheduled surgeries block deletion', () => {
    it('should block deletion if patient has SCHEDULED surgeries', async () => {
      const patient = await seedPatient();

      // Override the hasScheduledSurgeries to return true for this test
      jest
        .spyOn(repo, 'hasScheduledSurgeries')
        .mockResolvedValueOnce(true);

      await expect(
        useCase.execute({
          id: patient.id,
          organizationId: orgId,
        }),
      ).rejects.toThrow(ScheduledSurgeryBlocksDeleteError);
    });

    it('should allow deletion when no scheduled surgeries exist', async () => {
      const patient = await seedPatient();

      // Default InMemoryPatientRepository returns false for hasScheduledSurgeries
      const result = await useCase.execute({
        id: patient.id,
        organizationId: orgId,
      });

      expect(result.deletedAt).not.toBeNull();
    });
  });
});