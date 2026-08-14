// apps/api/src/application/imaging/queries/list-org-imaging-studies.use-case.spec.ts
import { describe, it, expect } from '@jest/globals';
import { ListOrgImagingStudiesUseCase } from './list-org-imaging-studies.use-case';
import { InMemoryImagingStudyRepository } from '../commands/in-memory-imaging-study.repository';

describe('ListOrgImagingStudiesUseCase', () => {
  it('returns paginated org-wide imaging studies', async () => {
    const repo = new InMemoryImagingStudyRepository();
    await repo.create({
      organizationId: 'org-1',
      patientId: 'p-1',
      type: 'MRI',
      date: new Date('2026-01-10T08:00:00Z'),
      description: 'MRI cabeza',
      createdBy: 'doc-1',
    });
    await repo.create({
      organizationId: 'org-1',
      patientId: 'p-2',
      type: 'CT_SCAN',
      date: new Date('2026-02-12T08:00:00Z'),
      description: 'TAC senos',
      createdBy: 'doc-2',
    });

    const useCase = new ListOrgImagingStudiesUseCase(repo);
    const result = await useCase.execute({
      organizationId: 'org-1',
      page: 1,
      pageSize: 20,
      sortBy: 'date',
      sortOrder: 'desc',
    });

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].type).toBe('CT_SCAN');
  });

  it('filters by type', async () => {
    const repo = new InMemoryImagingStudyRepository();
    await repo.create({
      organizationId: 'org-1',
      patientId: 'p-1',
      type: 'MRI',
      date: new Date('2026-01-10T08:00:00Z'),
      createdBy: 'doc-1',
    });
    await repo.create({
      organizationId: 'org-1',
      patientId: 'p-2',
      type: 'XRAY',
      date: new Date('2026-02-12T08:00:00Z'),
      createdBy: 'doc-2',
    });

    const useCase = new ListOrgImagingStudiesUseCase(repo);
    const result = await useCase.execute({
      organizationId: 'org-1',
      page: 1,
      pageSize: 20,
      type: 'MRI',
      sortBy: 'date',
      sortOrder: 'desc',
    });

    expect(result.total).toBe(1);
    expect(result.items[0].type).toBe('MRI');
  });

  it('isolates organizations', async () => {
    const repo = new InMemoryImagingStudyRepository();
    await repo.create({
      organizationId: 'org-1',
      patientId: 'p-1',
      type: 'MRI',
      date: new Date('2026-01-10T08:00:00Z'),
      createdBy: 'doc-1',
    });
    await repo.create({
      organizationId: 'org-2',
      patientId: 'p-2',
      type: 'MRI',
      date: new Date('2026-02-12T08:00:00Z'),
      createdBy: 'doc-2',
    });

    const useCase = new ListOrgImagingStudiesUseCase(repo);
    const result = await useCase.execute({
      organizationId: 'org-1',
      page: 1,
      pageSize: 20,
      sortBy: 'date',
      sortOrder: 'desc',
    });

    expect(result.total).toBe(1);
    expect(result.items[0].patientId).toBe('p-1');
  });
});