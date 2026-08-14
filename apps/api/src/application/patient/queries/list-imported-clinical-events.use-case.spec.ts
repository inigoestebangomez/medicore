import { ListImportedClinicalEventsUseCase } from './list-imported-clinical-events.use-case';
import { ImportedClinicalEventProjector } from '../services/imported-clinical-event-projector';

describe('ListImportedClinicalEventsUseCase', () => {
  it('returns duplicate-free keyset pages', async () => {
    const repository = {
      findImportedDataById: jest.fn().mockResolvedValue({
        importedData: {
          a: { admissionDate: '2026-01-01', diagnosis: 'one' },
          b: { admissionDate: '2026-01-02', diagnosis: 'two' },
        }, importSource: 'xlsx', updatedAt: new Date('2026-02-01'),
      }),
    };
    const useCase = new ListImportedClinicalEventsUseCase(repository as any, new ImportedClinicalEventProjector());
    const first = await useCase.execute({ patientId: 'p1', organizationId: 'o1', pageSize: 1 });
    const second = await useCase.execute({ patientId: 'p1', organizationId: 'o1', pageSize: 1, cursor: first.nextCursor! });
    expect(first.items).toHaveLength(1);
    expect(second.items).toHaveLength(1);
    expect(second.items[0].id).not.toBe(first.items[0].id);
  });

  it('invalidates a cursor when the snapshot changes', async () => {
    const repository = {
      findImportedDataById: jest.fn().mockResolvedValue({
        importedData: { a: { diagnosis: 'one' }, b: { diagnosis: 'two' } }, importSource: 'xlsx', updatedAt: new Date('2026-02-01'),
      }),
    };
    const useCase = new ListImportedClinicalEventsUseCase(repository as any, new ImportedClinicalEventProjector());
    const first = await useCase.execute({ patientId: 'p1', organizationId: 'o1', pageSize: 1 });
    repository.findImportedDataById.mockResolvedValue({ importedData: { a: { diagnosis: 'changed' }, b: { diagnosis: 'two' } }, importSource: 'xlsx', updatedAt: new Date('2026-02-02') });
    await expect(useCase.execute({ patientId: 'p1', organizationId: 'o1', cursor: first.nextCursor! })).rejects.toThrow('cursor');
  });
});
