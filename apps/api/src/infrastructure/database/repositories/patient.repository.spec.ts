import { describe, expect, it, jest } from '@jest/globals';
import { PrismaPatientRepository, shouldReplaceBirthDate } from './patient.repository';

describe('shouldReplaceBirthDate', () => {
  it('replaces the exact import placeholder with a valid date', () => {
    expect(shouldReplaceBirthDate(new Date('1900-01-01'), new Date('1984-03-12'))).toBe(true);
  });

  it('does not replace a real birth date', () => {
    expect(shouldReplaceBirthDate(new Date('1984-03-12'), new Date('1990-01-01'))).toBe(false);
  });

  it('does not replace with an invalid or placeholder date', () => {
    expect(shouldReplaceBirthDate(new Date('1900-01-01'), new Date('invalid'))).toBe(false);
    expect(shouldReplaceBirthDate(null, new Date('1900-01-01'))).toBe(false);
  });
});

describe('PrismaPatientRepository.enrich', () => {
  it('preserves manual notes while applying import enrichment', async () => {
    const existing = {
      id: 'p-1',
      organizationId: 'org-1',
      nhc: '123',
      firstName: 'Ana',
      lastName: 'Garcia',
      birthDate: null,
      sex: 'UNKNOWN',
      phone: null,
      email: null,
      address: null,
      emergencyContact: null,
      idDocument: null,
      idDocType: 'DNI',
      bloodType: 'UNKNOWN',
      notes: 'Manual note',
      createdBy: 'u-1',
      updatedBy: null,
      importedData: null,
      importSource: null,
      importBatchId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    const prisma = {
      patient: {
        findFirst: jest.fn<() => Promise<typeof existing>>().mockResolvedValue(existing),
        update: jest.fn<(args: { data: Record<string, unknown> }) => Promise<typeof existing>>()
          .mockImplementation(async ({ data }) => ({ ...existing, ...data })),
      },
    };

    const repository = new PrismaPatientRepository(prisma as any);
    const result = await repository.enrich(
      'p-1',
      'org-1',
      { importedData: { batch: { diagnosis: 'N/A' } }, importBatchId: 'batch-1', importSource: 'csv' },
      'u-2',
    );

    expect(result.notes).toBe('Manual note');
    expect(prisma.patient.update).toHaveBeenCalledWith({
      where: { id: 'p-1' },
      data: expect.not.objectContaining({ notes: expect.anything() }),
    });
  });
});

describe('PrismaPatientRepository.findByNhcIncludingDeleted', () => {
  it('scopes by organization and includes a soft-deleted patient', async () => {
    const deleted = {
      id: 'p-1',
      organizationId: 'org-1',
      nhc: '123',
      firstName: 'Ana',
      lastName: 'Garcia',
      birthDate: null,
      sex: 'FEMALE',
      deletedAt: new Date('2026-01-01'),
      createdBy: 'u-1',
    };
    const prisma = {
      patient: { findFirst: (jest.fn() as jest.Mock<any>).mockResolvedValue(deleted) },
    };

    const repository = new PrismaPatientRepository(prisma as any);
    const result = await repository.findByNhcIncludingDeleted('123', 'org-1');

    expect(prisma.patient.findFirst).toHaveBeenCalledWith({ where: { organizationId: 'org-1', nhc: '123' } });
    expect(result?.deletedAt).toEqual(deleted.deletedAt);
  });
});
