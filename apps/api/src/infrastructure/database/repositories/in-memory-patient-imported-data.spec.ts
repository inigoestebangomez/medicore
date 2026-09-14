import { InMemoryPatientRepository } from './in-memory-patient.repository';

describe('InMemoryPatientRepository imported data projection read', () => {
  it('fills empty standard fields without overwriting manual values', async () => {
    const repository = new InMemoryPatientRepository();
    const patient = await repository.create({
      nhc: '2026-00000', firstName: null, lastName: 'Manual', birthDate: null, sex: 'UNKNOWN',
      phone: null, organizationId: 'org-a', createdBy: 'user-a',
    });

    const enriched = await repository.enrich(patient.id, 'org-a', {
      firstName: 'Ana', lastName: 'Importada', phone: '666111222', sex: 'UNKNOWN', importedData: {},
    }, 'user-a');

    expect(enriched).toMatchObject({ firstName: 'Ana', lastName: 'Manual', phone: '666111222', sex: 'UNKNOWN' });
  });

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

  it('fills empty native demographics but preserves existing text and JSON values', async () => {
    const repository = new InMemoryPatientRepository();
    const patient = await repository.create({
      nhc: '2026-00003', firstName: 'Ana', lastName: 'Manual', birthDate: null, sex: 'UNKNOWN',
      email: 'manual@example.com', address: { street: 'Manual' }, organizationId: 'org-a', createdBy: 'user-a',
    });

    const enriched = await repository.enrich(patient.id, 'org-a', {
      email: 'import@example.com', address: { street: 'Importada' }, bloodType: 'A_POS',
      emergencyContact: { name: 'Luis' }, notes: 'Importada', importedData: {},
    }, 'user-a');

    expect(enriched).toMatchObject({
      email: 'manual@example.com', address: { street: 'Manual' }, bloodType: 'A_POS',
      emergencyContact: { name: 'Luis' }, notes: 'Importada',
    });
  });

  it('replaces a non-January year-1900 birth placeholder during enrichment', async () => {
    const repository = new InMemoryPatientRepository();
    const patient = await repository.create({
      nhc: '2026-00004', firstName: 'Ana', lastName: 'Placeholder',
      birthDate: new Date('1900-04-10'), sex: 'UNKNOWN', organizationId: 'org-a', createdBy: 'user-a',
    });

    const enriched = await repository.enrich(patient.id, 'org-a', {
      birthDate: new Date('1984-03-12'), importedData: {},
    }, 'user-a');

    expect(enriched.birthDate?.toISOString()).toBe('1984-03-12T00:00:00.000Z');
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
