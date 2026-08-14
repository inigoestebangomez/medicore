import { InMemoryPatientRepository } from './in-memory-patient.repository';

describe('InMemoryPatientRepository imported data projection read', () => {
  it('returns only the tenant-scoped imported snapshot', async () => {
    const repository = new InMemoryPatientRepository();
    const patient = await repository.create({
      nhc: '2026-00001', firstName: 'Synthetic', lastName: 'Patient', birthDate: null, sex: 'UNKNOWN',
      phone: 'private', email: 'private@example.test', organizationId: 'org-a', createdBy: 'user-a',
    });
    await repository.enrich(patient.id, 'org-a', {
      importedData: { batch: { diagnosis: 'synthetic' } }, importSource: 'xlsx',
    }, 'user-a');
    const snapshot = await repository.findImportedDataById(patient.id, 'org-a');
    expect(snapshot).toEqual(expect.objectContaining({ importedData: { batch: { diagnosis: 'synthetic' } }, importSource: 'xlsx' }));
    expect(snapshot).not.toHaveProperty('email');
  });

  it('returns null for another organization', async () => {
    const repository = new InMemoryPatientRepository();
    const patient = await repository.create({
      nhc: '2026-00002', firstName: 'Synthetic', lastName: 'Other', birthDate: null, sex: 'UNKNOWN',
      organizationId: 'org-a', createdBy: 'user-a',
    });
    expect(await repository.findImportedDataById(patient.id, 'org-b')).toBeNull();
  });
});
