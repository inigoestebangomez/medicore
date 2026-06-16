// apps/api/src/application/patient/queries/get-patient.use-case.spec.ts
import { GetPatientUseCase } from './get-patient.use-case';
import { InMemoryPatientRepository } from '@/infrastructure/database/repositories/in-memory-patient.repository';
import { Patient } from '@/domain/patient/patient.entity';
import { PatientNotFoundError } from '@/domain/patient/errors/patient-not-found.error';

describe('GetPatientUseCase', () => {
  let useCase: GetPatientUseCase;
  let repo: InMemoryPatientRepository;

  const orgId = 'org-1';
  const userId = 'user-1';

  beforeEach(() => {
    repo = new InMemoryPatientRepository();
    useCase = new GetPatientUseCase(repo);
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
      address: { street: 'Calle Mayor 1', city: 'Madrid' },
      emergencyContact: { name: 'Juan García', relationship: 'spouse', phone: '+34612345679' },
      ...overrides,
    });
  }

  it('should return patient with all fields for PHYSICIAN role', async () => {
    const patient = await seedPatient();

    const result = await useCase.execute({
      id: patient.id,
      organizationId: orgId,
      role: 'PHYSICIAN',
    });

    expect(result.id).toBe(patient.id);
    expect(result.firstName).toBe('María');
    expect(result.lastName).toBe('García López');
    expect(result.phone).toBe('+34612345678');
    expect(result.email).toBe('maria@example.com');
    expect(result.idDocument).toBe('12345678A');
    expect(result.address).toEqual({ street: 'Calle Mayor 1', city: 'Madrid' });
    expect(result.nhc).toBeDefined();
    expect(result.age).toBeGreaterThanOrEqual(0);
    expect(result.isPediatric).toBe(false);
    expect(result.hasCriticalAllergy).toBe(false);
    expect(result.hasActiveAllergies).toBe(false);
  });

  it('should omit phone, email, address, idDocument for VIEWER role (BR-RBAC-002)', async () => {
    const patient = await seedPatient();

    const result = await useCase.execute({
      id: patient.id,
      organizationId: orgId,
      role: 'VIEWER',
    });

    expect(result.id).toBe(patient.id);
    expect(result.firstName).toBe('María');
    expect(result.lastName).toBe('García López');
    // Sensitive fields should NOT be present for VIEWER
    expect(result).not.toHaveProperty('phone');
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('address');
    expect(result).not.toHaveProperty('idDocument');
    expect(result).not.toHaveProperty('emergencyContact');
  });

  it('should throw PatientNotFoundError for missing patient', async () => {
    await expect(
      useCase.execute({
        id: 'nonexistent-id',
        organizationId: orgId,
        role: 'PHYSICIAN',
      }),
    ).rejects.toThrow(PatientNotFoundError);
  });

  it('should return null for patient in different organization', async () => {
    const patient = await seedPatient();

    await expect(
      useCase.execute({
        id: patient.id,
        organizationId: 'other-org',
        role: 'PHYSICIAN',
      }),
    ).rejects.toThrow(PatientNotFoundError);
  });
});