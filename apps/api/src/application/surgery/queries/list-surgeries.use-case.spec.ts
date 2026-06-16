// apps/api/src/application/surgery/queries/list-surgeries.use-case.spec.ts
import { ListSurgeriesUseCase } from './list-surgeries.use-case';
import { InMemorySurgeryRepository } from '../commands/in-memory-surgery.repository';

describe('ListSurgeriesUseCase', () => {
  let useCase: ListSurgeriesUseCase;
  let repo: InMemorySurgeryRepository;

  const orgId = 'org-1';
  const patientId = 'patient-1';
  const userId = 'user-1';

  beforeEach(() => {
    repo = new InMemorySurgeryRepository();
    useCase = new ListSurgeriesUseCase(repo);
  });

  async function seedSurgeries(count: number, statusOverride?: string): Promise<void> {
    for (let i = 0; i < count; i++) {
      await repo.create({
        patientId,
        organizationId: orgId,
        date: new Date(2026, 0, i + 1),
        status: (statusOverride ?? (i % 2 === 0 ? 'SCHEDULED' : 'COMPLETED')) as any,
        physicianId: 'physician-1',
        procedureType: `Procedure ${i + 1}`,
        asa: 'ASA_II',
        createdBy: userId,
      });
    }
  }

  it('should return paginated list for a patient', async () => {
    await seedSurgeries(5);

    const result = await useCase.execute({
      patientId,
      organizationId: orgId,
      page: 1,
      pageSize: 3,
      sortBy: 'date',
      sortOrder: 'desc',
    });

    expect(result.items).toHaveLength(3);
    expect(result.total).toBe(5);
    expect(result.totalPages).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(3);
  });

  it('should return second page correctly', async () => {
    await seedSurgeries(5);

    const result = await useCase.execute({
      patientId,
      organizationId: orgId,
      page: 2,
      pageSize: 3,
      sortBy: 'date',
      sortOrder: 'desc',
    });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(5);
  });

  it('should filter by status', async () => {
    await seedSurgeries(4);

    const result = await useCase.execute({
      patientId,
      organizationId: orgId,
      page: 1,
      pageSize: 10,
      status: 'SCHEDULED',
      sortBy: 'date',
      sortOrder: 'desc',
    });

    expect(result.items.every((i) => i.status === 'SCHEDULED')).toBe(true);
  });

  it('should filter by date range', async () => {
    await seedSurgeries(5);

    const result = await useCase.execute({
      patientId,
      organizationId: orgId,
      page: 1,
      pageSize: 10,
      from: new Date('2026-01-02'),
      to: new Date('2026-01-04'),
      sortBy: 'date',
      sortOrder: 'asc',
    });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.length).toBeLessThan(5);
  });

  it('should return empty list for no surgeries', async () => {
    const result = await useCase.execute({
      patientId,
      organizationId: orgId,
      page: 1,
      pageSize: 10,
      sortBy: 'date',
      sortOrder: 'desc',
    });

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });
});