// apps/api/src/application/patient/queries/search-patients.use-case.spec.ts
import { SearchPatientsUseCase } from './search-patients.use-case';
import { InMemoryPatientRepository } from '@/infrastructure/database/repositories/in-memory-patient.repository';

describe('SearchPatientsUseCase', () => {
  let useCase: SearchPatientsUseCase;
  let repo: InMemoryPatientRepository;

  const orgId = 'org-1';
  const userId = 'user-1';

  beforeEach(() => {
    repo = new InMemoryPatientRepository();
    useCase = new SearchPatientsUseCase(repo);
  });

  async function seedSearchPatients(): Promise<void> {
    const patients = [
      { firstName: 'María', lastName: 'García López', idDocument: '12345678A' },
      { firstName: 'Carlos', lastName: 'García Ruiz', idDocument: '87654321B' },
      { firstName: 'Ana', lastName: 'Martínez Sánchez', idDocument: '11111111C' },
      { firstName: 'Pedro', lastName: 'Fernández López', idDocument: '22222222D' },
    ];

    for (const p of patients) {
      await repo.create({
        nhc: await repo.getNextNhcSequence(orgId),
        firstName: p.firstName,
        lastName: p.lastName,
        birthDate: new Date('1985-06-15'),
        sex: 'FEMALE',
        idDocument: p.idDocument,
        idDocType: 'DNI',
        organizationId: orgId,
        createdBy: userId,
      });
    }
  }

  it('should search by lastName (case-insensitive)', async () => {
    await seedSearchPatients();

    const result = await useCase.execute({
      organizationId: orgId,
      role: 'PHYSICIAN',
      query: 'garcía',
      page: 1,
      pageSize: 10,
      sortBy: 'lastName',
      sortOrder: 'asc',
    });

    expect(result.items.length).toBeGreaterThanOrEqual(2);
    expect(result.items.every((p) => p.lastName.toLowerCase().includes('garcía'))).toBe(true);
  });

  it('should search by firstName', async () => {
    await seedSearchPatients();

    const result = await useCase.execute({
      organizationId: orgId,
      role: 'PHYSICIAN',
      query: 'María',
      page: 1,
      pageSize: 10,
      sortBy: 'lastName',
      sortOrder: 'asc',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].firstName).toBe('María');
  });

  it('should search by NHC', async () => {
    await seedSearchPatients();

    // Get the first patient's NHC
    const allResult = await useCase.execute({
      organizationId: orgId,
      role: 'PHYSICIAN',
      query: 'García',
      page: 1,
      pageSize: 10,
      sortBy: 'lastName',
      sortOrder: 'asc',
    });
    const nhc = allResult.items[0].nhc;

    const result = await useCase.execute({
      organizationId: orgId,
      role: 'PHYSICIAN',
      query: nhc,
      page: 1,
      pageSize: 10,
      sortBy: 'lastName',
      sortOrder: 'asc',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].nhc).toBe(nhc);
  });

  it('should search by idDocument for PHYSICIAN role', async () => {
    await seedSearchPatients();

    const result = await useCase.execute({
      organizationId: orgId,
      role: 'PHYSICIAN',
      query: '12345678',
      page: 1,
      pageSize: 10,
      sortBy: 'lastName',
      sortOrder: 'asc',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].idDocument).toBe('12345678A');
  });

  it('should filter by organizationId', async () => {
    await seedSearchPatients();
    // Create a patient in org-2 with a matching name
    await repo.create({
      nhc: await repo.getNextNhcSequence('org-2'),
      firstName: 'Test',
      lastName: 'García',
      birthDate: new Date('1990-01-01'),
      sex: 'MALE',
      organizationId: 'org-2',
      createdBy: userId,
    });

    const result = await useCase.execute({
      organizationId: orgId,
      role: 'PHYSICIAN',
      query: 'García',
      page: 1,
      pageSize: 10,
      sortBy: 'lastName',
      sortOrder: 'asc',
    });

    // Only org-1 Garcia patients
    expect(result.items.every((p) => p.lastName.includes('García'))).toBe(true);
  });

  it('should return empty results for non-matching query', async () => {
    await seedSearchPatients();

    const result = await useCase.execute({
      organizationId: orgId,
      role: 'PHYSICIAN',
      query: 'ZZZZZZZnonexistent',
      page: 1,
      pageSize: 10,
      sortBy: 'lastName',
      sortOrder: 'asc',
    });

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should return null birthDate/age for a matched patient without DOB (SDD import-data-quality)', async () => {
    await repo.create({
      nhc: await repo.getNextNhcSequence(orgId),
      firstName: 'NoDob',
      lastName: 'García',
      birthDate: null,
      sex: 'MALE',
      organizationId: orgId,
      createdBy: userId,
    });

    const result = await useCase.execute({
      organizationId: orgId,
      role: 'PHYSICIAN',
      query: 'García',
      page: 1,
      pageSize: 10,
      sortBy: 'lastName',
      sortOrder: 'asc',
    });

    const noDob = result.items.find((p) => p.firstName === 'NoDob');
    expect(noDob).toBeDefined();
    expect(noDob!.birthDate).toBeNull();
    expect(noDob!.age).toBeNull();
  });
});