import { describe, expect, it, jest } from '@jest/globals';
import { ImportBatch } from '@/domain/import/import-batch.entity';
import { DataCleanerService } from '@/application/import/services/data-cleaner.service';
import { ImportNhcConflictError } from '@/domain/import/errors/import-nhc-conflict.error';
import { Patient } from '@/domain/patient/patient.entity';
import { ImportProcessor, isTransientImportError } from './import-processor';
import { UnrecoverableError } from 'bullmq';

function makeBatch(status: 'CONFIRMING' | 'COMPLETED'): ImportBatch {
  return new ImportBatch({
    id: 'batch-1',
    organizationId: 'org-1',
    createdBy: 'user-1',
    fileName: 'patients.csv',
    fileSize: 10,
    fileHash: 'hash',
    originalFormat: 'csv',
    sample: { columns: [], rows: [] },
    columnMapping: {},
    status,
    createdRows: status === 'COMPLETED' ? 2 : 0,
    enrichedRows: status === 'COMPLETED' ? 1 : 0,
    skippedRows: status === 'COMPLETED' ? 3 : 0,
  });
}

function makeMock(): jest.Mock<any> {
  return jest.fn() as jest.Mock<any>;
}

function makePatient(overrides: Partial<ConstructorParameters<typeof Patient>[0]> = {}): Patient {
  return new Patient({
    id: 'patient-1',
    organizationId: 'org-1',
    nhc: '123',
    firstName: 'Ana',
    lastName: 'Garcia',
    birthDate: null,
    sex: 'FEMALE',
    createdBy: 'user-1',
    ...overrides,
  } as any);
}

function makeImportBatch(): ImportBatch {
  return new ImportBatch({
    id: 'batch-1',
    organizationId: 'org-1',
    createdBy: 'user-1',
    fileName: 'patients.csv',
    fileSize: 10,
    fileHash: 'hash',
    originalFormat: 'csv',
    sample: { columns: ['NHC', 'Nombre', 'Sexo'], rows: [] },
    columnMapping: { NHC: 'nhc', Nombre: 'patientName', Sexo: 'sex' },
    status: 'CONFIRMING',
  });
}

function makeParsed(rows: Array<Record<string, unknown>>) {
  return {
    columns: ['NHC', 'Nombre', 'Sexo'],
    rows,
    sample: { columns: [], rows: [] },
    totalRows: rows.length,
    originalFormat: 'csv',
  };
}

function makeBatchRepo(batch = makeImportBatch()) {
  return {
    findById: makeMock().mockResolvedValue(batch),
    updateStatus: makeMock(),
    updateCounters: makeMock(),
  };
}

function makeCache(rows: Array<Record<string, unknown>>) {
  return { get: makeMock().mockResolvedValue(makeParsed(rows)), delete: makeMock() };
}

function makeProcessor(batchRepo: any, patientRepo: any, cache: any) {
  return new ImportProcessor(batchRepo, patientRepo, new DataCleanerService(), cache);
}

describe('ImportProcessor finalize safeguards', () => {
  it.each(['57P01', 'E57P01', 'P1001', 'P1002', 'P1008', 'P1017'])('recognizes %s as transient connectivity', (code) => {
    expect(isTransientImportError({ code })).toBe(true);
  });

  it('does not classify functional domain errors as transient', () => {
    expect(isTransientImportError(new ImportNhcConflictError('123', 'soft-deleted'))).toBe(false);
  });

  it('blocks unidentifiable rows before changing the batch status', async () => {
    const batch = makeBatch('CONFIRMING').applyConfirmedMapping({
      columnMapping: {
        NHC: 'nhc',
        Nombre: 'patientName',
        Edad: 'age',
        Sexo: 'sex',
        Diagnóstico: 'diagnosis',
      },
    });
    const batchRepo = {
      findById: jest.fn<(id: string, organizationId: string) => Promise<ImportBatch | null>>().mockResolvedValue(batch),
      updateStatus: jest.fn(),
    };
    const cache = {
      get: jest.fn<(id: string, organizationId: string) => Promise<any>>().mockResolvedValue({
        columns: ['NHC', 'Nombre', 'Edad', 'Sexo', 'Diagnóstico'],
        rows: [{ NHC: '', Nombre: '', Edad: 50, Sexo: 'M', Diagnóstico: 'review' }],
        sample: { columns: [], rows: [] },
        totalRows: 1,
        originalFormat: 'csv',
      }),
    };
    const processor = new ImportProcessor(batchRepo as any, {} as any, new DataCleanerService(), cache as any);

    await expect(processor.handleFinalize({ data: { batchId: 'batch-1', organizationId: 'org-1', userId: 'user-1', matchResolutions: {} } } as any))
      .rejects.toBeInstanceOf(UnrecoverableError);
    expect(batchRepo.updateStatus).toHaveBeenCalledWith('batch-1', 'org-1', 'FAILED', expect.stringContaining('pending import row'));
  });

  it('returns completed counters without reading the cache on a retry', async () => {
    const batchRepo = { findById: jest.fn<(id: string, organizationId: string) => Promise<ImportBatch | null>>().mockResolvedValue(makeBatch('COMPLETED')) };
    const cache = { get: jest.fn() };
    const processor = new ImportProcessor(batchRepo as any, {} as any, new DataCleanerService(), cache as any);

    await expect(processor.handleFinalize({ data: { batchId: 'batch-1', organizationId: 'org-1', userId: 'user-1', matchResolutions: {} } } as any))
      .resolves.toEqual({ created: 2, enriched: 1, skipped: 3, discardedRowCount: 0 });
    expect(cache.get).not.toHaveBeenCalled();
  });

  it('revalidates an active NHC even when the UI decision is new and enriches it', async () => {
    const existing = makePatient();
    const patientRepo = {
      findByNhc: makeMock().mockResolvedValue(existing),
      findByNhcIncludingDeleted: makeMock(),
      create: makeMock(),
      enrich: makeMock().mockResolvedValue(existing),
      findByImportBatchRow: makeMock().mockResolvedValue(null),
    };
    const batchRepo = makeBatchRepo();
    const processor = makeProcessor(batchRepo, patientRepo, makeCache([{ NHC: '123', Nombre: 'Ana Garcia', Sexo: 'M' }]));

    await expect(processor.handleFinalize({
      data: { batchId: 'batch-1', organizationId: 'org-1', userId: 'user-1', matchResolutions: { '0': 'new' } },
    } as any)).resolves.toEqual({ created: 0, enriched: 1, skipped: 0, discardedRowCount: 0 });
    expect(patientRepo.create).not.toHaveBeenCalled();
    expect(patientRepo.enrich).toHaveBeenCalledTimes(1);
  });

  it('blocks an NHC occupied by a soft-deleted patient without restoring it', async () => {
    const deleted = makePatient({ deletedAt: new Date('2026-01-01') });
    const patientRepo = {
      findByNhc: makeMock().mockResolvedValue(null),
      findByNhcIncludingDeleted: makeMock().mockResolvedValue(deleted),
      create: makeMock(),
      enrich: makeMock(),
      findByImportBatchRow: makeMock().mockResolvedValue(null),
    };
    const batchRepo = makeBatchRepo();
    const processor = makeProcessor(batchRepo, patientRepo, makeCache([{ NHC: '123', Nombre: 'Ana Garcia', Sexo: 'M' }]));

    const finalize = processor.handleFinalize({
      data: { batchId: 'batch-1', organizationId: 'org-1', userId: 'user-1', matchResolutions: {} },
    } as any);
    await expect(finalize).rejects.toBeInstanceOf(UnrecoverableError);
    expect(patientRepo.create).not.toHaveBeenCalled();
    expect(batchRepo.updateStatus).toHaveBeenLastCalledWith('batch-1', 'org-1', 'FAILED', expect.stringContaining('paciente eliminado'));
  });

  it('converts an unresolved P2002 into an actionable domain error', async () => {
    const patientRepo = {
      findByNhc: makeMock().mockResolvedValue(null),
      findByNhcIncludingDeleted: makeMock().mockResolvedValue(null),
      create: makeMock().mockRejectedValue({ code: 'P2002' }),
      enrich: makeMock(),
      findByImportBatchRow: makeMock().mockResolvedValue(null),
    };
    const batchRepo = makeBatchRepo();
    const processor = makeProcessor(batchRepo, patientRepo, makeCache([{ NHC: '123', Nombre: 'Ana Garcia', Sexo: 'M' }]));

    await expect(processor.handleFinalize({
      data: { batchId: 'batch-1', organizationId: 'org-1', userId: 'user-1', matchResolutions: {} },
    } as any)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(batchRepo.updateStatus).toHaveBeenLastCalledWith('batch-1', 'org-1', 'FAILED', expect.stringContaining('colision concurrente'));
  });

  it('reuses and enriches the patient when two rows in the same Excel share an NHC', async () => {
    let current: Patient | null = null;
    const patientRepo = {
      findByNhc: makeMock().mockImplementation(async () => current),
      findByNhcIncludingDeleted: makeMock().mockResolvedValue(null),
      create: makeMock().mockImplementation(async () => {
        current = makePatient();
        return current;
      }),
      enrich: makeMock().mockImplementation(async (_id: string, _org: string, data: { importedData: Record<string, unknown>; importBatchId: string }) => {
        current = new Patient({ ...current!, importedData: data.importedData, importBatchId: data.importBatchId } as any);
        return current;
      }),
      findByImportBatchRow: makeMock().mockResolvedValue(null),
    };
    const batchRepo = makeBatchRepo();
    const processor = makeProcessor(batchRepo, patientRepo, makeCache([
      { NHC: '123', Nombre: 'Ana Garcia', Sexo: 'M' },
      { NHC: '123', Nombre: 'Ana Garcia', Sexo: 'M' },
    ]));

    await expect(processor.handleFinalize({
      data: { batchId: 'batch-1', organizationId: 'org-1', userId: 'user-1', matchResolutions: {} },
    } as any)).resolves.toEqual({ created: 1, enriched: 1, skipped: 0, discardedRowCount: 0 });
    expect(patientRepo.create).toHaveBeenCalledTimes(1);
    expect(patientRepo.enrich).toHaveBeenCalledTimes(2);
    const secondEnrichment = (patientRepo.enrich as jest.Mock<any>).mock.calls[1][2] as any;
    expect(secondEnrichment.importedData['batch-1']._rowIndices).toEqual([0, 1]);
  });

  it('stores mapped Date values as ISO strings in importedData', async () => {
    const batch = makeImportBatch().applyConfirmedMapping({
      columnMapping: {
        NHC: 'nhc',
        Nombre: 'patientName',
        Ingreso: 'admissionDate',
        Solicitud: 'requestDate',
        Realización: 'completionDate',
      },
    });
    const patient = makePatient();
    const patientRepo = {
      findByNhc: makeMock().mockResolvedValue(null),
      findByNhcIncludingDeleted: makeMock().mockResolvedValue(null),
      create: makeMock().mockResolvedValue(patient),
      enrich: makeMock().mockResolvedValue(patient),
      findByImportBatchRow: makeMock().mockResolvedValue(null),
    };
    const batchRepo = makeBatchRepo(batch);
    const processor = makeProcessor(batchRepo, patientRepo, makeCache([{
      NHC: '123',
      Nombre: 'Ana Garcia',
      Ingreso: new Date(Date.UTC(2025, 4, 8)),
      Solicitud: new Date(Date.UTC(2025, 2, 27)),
      Realización: new Date(Date.UTC(1968, 2, 5)),
    }]));

    await expect(processor.handleFinalize({
      data: { batchId: 'batch-1', organizationId: 'org-1', userId: 'user-1', matchResolutions: {} },
    } as any)).resolves.toEqual({ created: 1, enriched: 0, skipped: 0, discardedRowCount: 0 });

    const enrichedData = ((patientRepo.enrich as jest.Mock<any>).mock.calls[0][2] as {
      importedData: Record<string, Record<string, unknown>>;
    }).importedData['batch-1'];
    expect(enrichedData.admissionDate).toBe('2025-05-08T00:00:00.000Z');
    expect(enrichedData.requestDate).toBe('2025-03-27T00:00:00.000Z');
    expect(enrichedData.completionDate).toBe('1968-03-05T00:00:00.000Z');
    expect(JSON.stringify(enrichedData)).not.toContain('[object Date]');
  });

  it('stores the original age as ageAtImport without adding a patient column', async () => {
    const batch = makeImportBatch().applyConfirmedMapping({
      columnMapping: { NHC: 'nhc', Nombre: 'patientName', Edad: 'age' },
    });
    const patient = makePatient();
    const patientRepo = {
      findByNhc: makeMock().mockResolvedValue(null),
      findByNhcIncludingDeleted: makeMock().mockResolvedValue(null),
      create: makeMock().mockResolvedValue(patient),
      enrich: makeMock().mockResolvedValue(patient),
      findByImportBatchRow: makeMock().mockResolvedValue(null),
    };

    const processor = makeProcessor(makeBatchRepo(batch), patientRepo, makeCache([
      { NHC: '123', Nombre: 'Ana Garcia', Edad: '45 años' },
    ]));

    await expect(processor.handleFinalize({
      data: { batchId: 'batch-1', organizationId: 'org-1', userId: 'user-1', matchResolutions: {} },
    } as any)).resolves.toEqual({ created: 1, enriched: 0, skipped: 0, discardedRowCount: 0 });

    const importedData = ((patientRepo.enrich as jest.Mock<any>).mock.calls[0][2] as any).importedData['batch-1'];
    expect(importedData.ageAtImport).toBe('45 años');
  });

  it('re-reads the active patient after P2002 and enriches instead of exposing Prisma error', async () => {
    const existing = makePatient();
    let lookupCount = 0;
    const patientRepo = {
      findByNhc: makeMock().mockImplementation(async () => (++lookupCount === 1 ? null : existing)),
      findByNhcIncludingDeleted: makeMock().mockResolvedValue(null),
      create: makeMock().mockRejectedValue({ code: 'P2002' }),
      enrich: makeMock().mockResolvedValue(existing),
      findByImportBatchRow: makeMock().mockResolvedValue(null),
    };
    const batchRepo = makeBatchRepo();
    const processor = makeProcessor(batchRepo, patientRepo, makeCache([{ NHC: '123', Nombre: 'Ana Garcia', Sexo: 'M' }]));

    await expect(processor.handleFinalize({
      data: { batchId: 'batch-1', organizationId: 'org-1', userId: 'user-1', matchResolutions: {} },
    } as any)).resolves.toEqual({ created: 0, enriched: 1, skipped: 0, discardedRowCount: 0 });
    expect(patientRepo.findByNhc).toHaveBeenCalledTimes(2);
    expect(patientRepo.enrich).toHaveBeenCalledTimes(1);
    expect(batchRepo.updateStatus).toHaveBeenLastCalledWith('batch-1', 'org-1', 'COMPLETED');
  });

  it('does not write a row again when a finalize retry finds its batch row', async () => {
    const patientRepo = {
      findByNhc: makeMock(),
      create: makeMock(),
      enrich: makeMock(),
      findByImportBatchRow: makeMock().mockResolvedValue(makePatient()),
    };
    const batchRepo = makeBatchRepo();
    const processor = makeProcessor(batchRepo, patientRepo, makeCache([{ NHC: '123', Nombre: 'Ana Garcia', Sexo: 'M' }]));

    await expect(processor.handleFinalize({
      data: { batchId: 'batch-1', organizationId: 'org-1', userId: 'user-1', matchResolutions: {} },
    } as any)).resolves.toEqual({ created: 0, enriched: 0, skipped: 0, discardedRowCount: 0 });
    expect(patientRepo.findByNhc).not.toHaveBeenCalled();
    expect(patientRepo.create).not.toHaveBeenCalled();
    expect(patientRepo.enrich).not.toHaveBeenCalled();
    expect(batchRepo.updateCounters).toHaveBeenCalledWith('batch-1', 'org-1', expect.objectContaining({ importedRows: 1, enrichedRows: 1 }));
  });

  it('fails instead of completing when identifiable rows produce no patient writes', async () => {
    const batch = new ImportBatch({
      ...makeImportBatch(),
      columnMapping: { Nombre: 'patientName' },
    });
    const batchRepo = makeBatchRepo(batch);
    const patientRepo = {
      findByImportBatchRow: makeMock().mockResolvedValue(null),
      create: makeMock(),
      enrich: makeMock(),
    };
    const processor = makeProcessor(batchRepo, patientRepo, makeCache([{ Nombre: 'Ana Garcia' }]));

    await expect(processor.handleFinalize({
      data: { batchId: 'batch-1', organizationId: 'org-1', userId: 'user-1', matchResolutions: { '0': 'confirm' } },
    } as any)).rejects.toBeInstanceOf(UnrecoverableError);

    expect(batchRepo.updateStatus).toHaveBeenLastCalledWith(
      'batch-1',
      'org-1',
      'FAILED',
      expect.stringContaining('no procesó ningún paciente'),
    );
  });

  it('creates patients from the exact Nombre + Nº Paciente mapping', async () => {
    const batch = new ImportBatch({
      ...makeImportBatch(),
      columnMapping: { Nombre: 'patientName', 'Nº Paciente': 'nhc' },
    });
    const patient = makePatient();
    const patientRepo = {
      findByNhc: makeMock().mockResolvedValue(null),
      findByNhcIncludingDeleted: makeMock().mockResolvedValue(null),
      findByImportBatchRow: makeMock().mockResolvedValue(null),
      create: makeMock().mockResolvedValue(patient),
      enrich: makeMock().mockResolvedValue(patient),
    };
    const batchRepo = makeBatchRepo(batch);
    const processor = makeProcessor(batchRepo, patientRepo, makeCache([{ Nombre: 'Ana Garcia', 'Nº Paciente': '123456' }]));

    await expect(processor.handleFinalize({
      data: { batchId: 'batch-1', organizationId: 'org-1', userId: 'user-1', matchResolutions: {} },
    } as any)).resolves.toEqual({ created: 1, enriched: 0, skipped: 0, discardedRowCount: 0 });
    expect(patientRepo.create).toHaveBeenCalledWith(expect.objectContaining({ nhc: '123456' }));
  });

  it('keeps explicitly discarded rows out of imports and automatic skips', async () => {
    const batch = makeImportBatch().applyConfirmedMapping({
      columnMapping: { NHC: 'nhc', Nombre: 'patientName' },
      ignoredRows: [{ rowIndex: 1, reason: 'duplicate' }],
    });
    const patient = makePatient();
    const patientRepo = {
      findByNhc: makeMock().mockResolvedValue(null),
      findByNhcIncludingDeleted: makeMock().mockResolvedValue(null),
      create: makeMock().mockResolvedValue(patient),
      enrich: makeMock().mockResolvedValue(patient),
      findByImportBatchRow: makeMock().mockResolvedValue(null),
    };
    const batchRepo = makeBatchRepo(batch);
    const processor = makeProcessor(batchRepo, patientRepo, makeCache([
      { NHC: '123', Nombre: 'Ana Garcia' },
      { NHC: '456', Nombre: 'Duplicada' },
    ]));

    await expect(processor.handleFinalize({
      data: { batchId: 'batch-1', organizationId: 'org-1', userId: 'user-1', matchResolutions: {} },
    } as any)).resolves.toEqual({ created: 1, enriched: 0, skipped: 0, discardedRowCount: 1 });

    expect(batchRepo.updateCounters).toHaveBeenCalledWith('batch-1', 'org-1', {
      importedRows: 1,
      enrichedRows: 0,
      createdRows: 1,
      skippedRows: 0,
      pendingRows: 0,
    });
    expect(patientRepo.create).toHaveBeenCalledTimes(1);
  });

  it('rethrows early connectivity failures for Bull retry without marking FAILED', async () => {
    const batchRepo = {
      findById: makeMock().mockRejectedValue({ code: 'P1001', message: 'database unreachable' }),
      updateStatus: makeMock(),
    };
    const processor = new ImportProcessor(batchRepo as any, {} as any, new DataCleanerService(), {} as any);

    await expect(processor.handleFinalize({
      data: { batchId: 'batch-1', organizationId: 'org-1', userId: 'user-1', matchResolutions: {} },
    } as any)).rejects.toMatchObject({ code: 'P1001' });
    expect(batchRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('lets Bull retry when FAILED status persistence fails', async () => {
    const batchRepo = {
      findById: makeMock().mockResolvedValue(makeImportBatch()),
      updateStatus: makeMock().mockRejectedValue({ code: 'P1017', message: 'server closed connection' }),
    };
    const cache = { get: makeMock().mockResolvedValue(null) };
    const processor = new ImportProcessor(batchRepo as any, {} as any, new DataCleanerService(), cache as any);

    await expect(processor.handleFinalize({
      data: { batchId: 'batch-1', organizationId: 'org-1', userId: 'user-1', matchResolutions: {} },
    } as any)).rejects.toThrow(/cache miss/);
    expect(batchRepo.updateStatus).toHaveBeenCalledWith('batch-1', 'org-1', 'FAILED', expect.stringContaining('cache miss'));
  });
});
