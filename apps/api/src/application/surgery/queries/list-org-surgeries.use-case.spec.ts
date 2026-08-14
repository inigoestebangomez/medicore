// apps/api/src/application/surgery/queries/list-org-surgeries.use-case.spec.ts
import { describe, it, expect } from '@jest/globals';
import { ListOrgSurgeriesUseCase } from './list-org-surgeries.use-case';
import { InMemorySurgeryRepository } from '../commands/in-memory-surgery.repository';

describe('ListOrgSurgeriesUseCase', () => {
  it('returns paginated org-wide surgeries with empty patient names (in-memory)', async () => {
    const repo = new InMemorySurgeryRepository();
    await repo.create({
      organizationId: 'org-1',
      patientId: 'p-1',
      physicianId: 'doc-1',
      date: new Date('2026-01-15T08:00:00Z'),
      status: 'SCHEDULED',
      procedureType: 'Septoplastia',
      createdBy: 'doc-1',
    });
    await repo.create({
      organizationId: 'org-1',
      patientId: 'p-2',
      physicianId: 'doc-2',
      date: new Date('2026-02-20T08:00:00Z'),
      status: 'COMPLETED',
      procedureType: 'CENS bilateral',
      createdBy: 'doc-2',
    });

    const useCase = new ListOrgSurgeriesUseCase(repo);
    const result = await useCase.execute({
      organizationId: 'org-1',
      page: 1,
      pageSize: 20,
      sortBy: 'date',
      sortOrder: 'desc',
    });

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].procedureType).toBe('CENS bilateral');
    expect(result.totalPages).toBe(1);
  });

  it('filters by status and physicianId', async () => {
    const repo = new InMemorySurgeryRepository();
    await repo.create({
      organizationId: 'org-1',
      patientId: 'p-1',
      physicianId: 'doc-1',
      date: new Date('2026-01-15T08:00:00Z'),
      status: 'SCHEDULED',
      procedureType: 'A',
      createdBy: 'doc-1',
    });
    await repo.create({
      organizationId: 'org-1',
      patientId: 'p-2',
      physicianId: 'doc-2',
      date: new Date('2026-02-20T08:00:00Z'),
      status: 'COMPLETED',
      procedureType: 'B',
      createdBy: 'doc-2',
    });

    const useCase = new ListOrgSurgeriesUseCase(repo);
    const result = await useCase.execute({
      organizationId: 'org-1',
      page: 1,
      pageSize: 20,
      status: 'COMPLETED',
      physicianId: 'doc-2',
      sortBy: 'date',
      sortOrder: 'desc',
    });

    expect(result.total).toBe(1);
    expect(result.items[0].procedureType).toBe('B');
  });

  it('isolates organizations', async () => {
    const repo = new InMemorySurgeryRepository();
    await repo.create({
      organizationId: 'org-1',
      patientId: 'p-1',
      physicianId: 'doc-1',
      date: new Date('2026-01-15T08:00:00Z'),
      status: 'SCHEDULED',
      procedureType: 'A',
      createdBy: 'doc-1',
    });
    await repo.create({
      organizationId: 'org-2',
      patientId: 'p-2',
      physicianId: 'doc-2',
      date: new Date('2026-02-20T08:00:00Z'),
      status: 'SCHEDULED',
      procedureType: 'B',
      createdBy: 'doc-2',
    });

    const useCase = new ListOrgSurgeriesUseCase(repo);
    const result = await useCase.execute({
      organizationId: 'org-1',
      page: 1,
      pageSize: 20,
      sortBy: 'date',
      sortOrder: 'desc',
    });

    expect(result.total).toBe(1);
    expect(result.items[0].procedureType).toBe('A');
  });
});