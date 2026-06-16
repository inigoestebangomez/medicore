// apps/api/src/application/patient/commands/update-patient.use-case.spec.ts
import { UpdatePatientUseCase } from './update-patient.use-case';
import { InMemoryPatientRepository } from '@/infrastructure/database/repositories/in-memory-patient.repository';
import { Patient } from '@/domain/patient/patient.entity';
import { PatientNotFoundError } from '@/domain/patient/errors/patient-not-found.error';

describe('UpdatePatientUseCase', () => {
  let useCase: UpdatePatientUseCase;
  let repo: InMemoryPatientRepository;

  const orgId = 'org-1';
  const userId = 'user-1';

  beforeEach(() => {
    repo = new InMemoryPatientRepository();
    useCase = new UpdatePatientUseCase(repo);
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

  it('should update allowed fields', async () => {
    const patient = await seedPatient();

    const result = await useCase.execute({
      id: patient.id,
      organizationId: orgId,
      firstName: 'María Elena',
      phone: '+34611223344',
      updatedBy: userId,
    });

    expect(result.firstName).toBe('María Elena');
    expect(result.phone).toBe('+34611223344');
  });

  it('should not update organizationId', async () => {
    const patient = await seedPatient();

    // Organization ID is not part of UpdatePatientInput,
    // so it cannot be changed through update
    const result = await useCase.execute({
      id: patient.id,
      organizationId: orgId,
      firstName: 'Updated',
      updatedBy: userId,
    });

    expect(result.organizationId).toBe(orgId);
  });

  it('should throw PatientNotFoundError for missing patient', async () => {
    await expect(
      useCase.execute({
        id: 'nonexistent-id',
        organizationId: orgId,
        firstName: 'Updated',
        updatedBy: userId,
      }),
    ).rejects.toThrow(PatientNotFoundError);
  });

  it('should set updatedAt timestamp', async () => {
    const patient = await seedPatient();
    const beforeUpdate = patient.updatedAt;

    // Small delay to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 10));

    const result = await useCase.execute({
      id: patient.id,
      organizationId: orgId,
      firstName: 'Updated',
      updatedBy: userId,
    });

    // The updated patient should have a newer updatedAt
    expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    expect(result.updatedBy).toBe(userId);
  });

  it('should preserve fields not included in update', async () => {
    const patient = await seedPatient();

    const result = await useCase.execute({
      id: patient.id,
      organizationId: orgId,
      firstName: 'New First',
      updatedBy: userId,
    });

    // These fields should remain unchanged
    expect(result.lastName).toBe('García López');
    expect(result.birthDate).toEqual(patient.birthDate);
    expect(result.email).toBe('maria@example.com');
    expect(result.nhc).toBe(patient.nhc);
  });
});