// apps/api/src/application/patient/queries/list-patients.use-case.spec.ts
import { ListPatientsUseCase } from './list-patients.use-case';
import { InMemoryPatientRepository } from '@/infrastructure/database/repositories/in-memory-patient.repository';
import { Patient } from '@/domain/patient/patient.entity';

describe('ListPatientsUseCase', () => {
  let useCase: ListPatientsUseCase;
  let repo: InMemoryPatientRepository;

  const orgId = 'org-1';
  const userId = 'user-1';

  beforeEach(() => {
    repo = new InMemoryPatientRepository();
    useCase = new ListPatientsUseCase(repo);
  });

  async function seedPatients(count: number, orgOverride?: string): Promise<Patient[]> {
    const patients: Patient[] = [];
    for (let i = 0; i < count; i++) {
      const patient = await repo.create({
        nhc: await repo.getNextNhcSequence(orgOverride ?? orgId),
        firstName: `Patient${i + 1}`,
        lastName: `LastName${i + 1}`,
        birthDate: new Date(1990, 0, i + 1),
        sex: i % 2 === 0 ? 'MALE' : 'FEMALE',
        organizationId: orgOverride ?? orgId,
        createdBy: userId,
      });
      patients.push(patient);
    }
    return patients;
  }

  it('should return paginated patients for the organization', async () => {
    await seedPatients(5);

    const result = await useCase.execute({
      organizationId: orgId,
      role: 'PHYSICIAN',
      page: 1,
      pageSize: 3,
      sortBy: 'lastName',
      sortOrder: 'asc',
    });

    expect(result.items).toHaveLength(3);
    expect(result.total).toBe(5);
  });

  it('should filter by deletedAt: null (exclude soft-deleted)', async () => {
    const patients = await seedPatients(3);
    // Soft-delete one patient
    await repo.softDelete(patients[1].id, orgId);

    const result = await useCase.execute({
      organizationId: orgId,
      role: 'PHYSICIAN',
      page: 1,
      pageSize: 10,
      sortBy: 'lastName',
      sortOrder: 'asc',
    });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('should return totalPages and total count in metadata', async () => {
    await seedPatients(7);

    const result = await useCase.execute({
      organizationId: orgId,
      role: 'PHYSICIAN',
      page: 1,
      pageSize: 3,
      sortBy: 'lastName',
      sortOrder: 'asc',
    });

    expect(result.total).toBe(7);
    expect(result.totalPages).toBe(3); // ceil(7/3) = 3
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(3);
  });

  it('should return empty list if no patients exist', async () => {
    const result = await useCase.execute({
      organizationId: orgId,
      role: 'PHYSICIAN',
      page: 1,
      pageSize: 10,
      sortBy: 'lastName',
      sortOrder: 'asc',
    });

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('should not return patients from other organizations', async () => {
    await seedPatients(3, 'org-1');
    await seedPatients(2, 'org-2');

    const result = await useCase.execute({
      organizationId: 'org-1',
      role: 'PHYSICIAN',
      page: 1,
      pageSize: 10,
      sortBy: 'lastName',
      sortOrder: 'asc',
    });

    expect(result.items).toHaveLength(3);
    expect(result.total).toBe(3);
  });

  it('should return null birthDate/age for a patient without DOB (SDD import-data-quality)', async () => {
    await seedPatients(1);
    await repo.create({
      nhc: await repo.getNextNhcSequence(orgId),
      firstName: 'NoDob',
      lastName: 'Patient',
      birthDate: null,
      sex: 'MALE',
      organizationId: orgId,
      createdBy: userId,
    });

    const result = await useCase.execute({
      organizationId: orgId,
      role: 'PHYSICIAN',
      page: 1,
      pageSize: 10,
      sortBy: 'lastName',
      sortOrder: 'asc',
    });

    const noDob = result.items.find((p) => p.firstName === 'NoDob');
    expect(noDob).toBeDefined();
    expect(noDob!.birthDate).toBeNull();
    expect(noDob!.age).toBeNull();
    expect(noDob!.isPediatric).toBe(false);
  });
});