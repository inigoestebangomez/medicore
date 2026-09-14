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

  it('revalidates and enriches the explicit candidate for a name/age match without NHC', async () => {
    const candidate = makePatient({ id: 'patient-name-match', nhc: '2026-00001' });
    const patientRepo = {
      findById: makeMock().mockResolvedValue(candidate),
      findByNhc: makeMock().mockResolvedValue(null),
      findByNhcIncludingDeleted: makeMock().mockResolvedValue(null),
      create: makeMock(),
      enrich: makeMock().mockResolvedValue(candidate),
      findByImportBatchRow: makeMock().mockResolvedValue(null),
    };
    const processor = makeProcessor(
      makeBatchRepo(new ImportBatch({ ...makeImportBatch(), columnMapping: { Nombre: 'patientName', Edad: 'age' } })),
      patientRepo,
      makeCache([{ Nombre: 'Ana Garcia', Edad: '45 años', Teléfono: '666111222' }]),
    );

    await expect(processor.handleFinalize({
      data: {
        batchId: 'batch-1', organizationId: 'org-1', userId: 'user-1',
        matchResolutions: { '0': { decision: 'confirm', candidateId: candidate.id } },
      },
    } as any)).resolves.toEqual({ created: 0, enriched: 1, skipped: 0, discardedRowCount: 0 });

    expect(patientRepo.create).not.toHaveBeenCalled();
    expect(patientRepo.findById).toHaveBeenCalledWith(candidate.id, 'org-1');
    expect(patientRepo.enrich).toHaveBeenCalledWith(
      candidate.id,
      'org-1',
      expect.objectContaining({ firstName: 'Ana', lastName: 'Garcia', phone: '666111222' }),
      'user-1',
    );
  });

  it('skips a stale explicit candidate without falling back to another patient or creating one', async () => {
    const patientRepo = {
      findById: makeMock().mockResolvedValue(null),
      findByNhc: makeMock().mockResolvedValue(null),
      findByNhcIncludingDeleted: makeMock().mockResolvedValue(null),
      create: makeMock().mockResolvedValue(makePatient()),
      enrich: makeMock().mockResolvedValue(makePatient()),
      findByImportBatchRow: makeMock().mockResolvedValue(null),
    };
    const processor = makeProcessor(makeBatchRepo(), patientRepo, makeCache([
      { Nombre: 'Ana Garcia' },
      { Nombre: 'Luis Perez', NHC: '456' },
    ]));
    const warn = jest.spyOn((processor as any).logger, 'warn');

    await expect(processor.handleFinalize({
      data: {
        batchId: 'batch-1', organizationId: 'org-1', userId: 'user-1',
        matchResolutions: { '0': { decision: 'confirm', candidateId: 'stale-patient' } },
      },
    } as any)).resolves.toEqual({ created: 1, enriched: 0, skipped: 1, discardedRowCount: 0 });

    expect(patientRepo.findByNhc).toHaveBeenCalledTimes(1);
    expect(patientRepo.create).toHaveBeenCalledTimes(1);
    expect(patientRepo.enrich).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('stale or unavailable'));
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
    expect(importedData.birthDateEstimated).toBe(true);
    expect(importedData.birthDateReferenceYear).toBe(new Date(batch.createdAt).getUTCFullYear());
  });

  it('creates and preserves mapped native demographics while keeping clinical fields in provenance', async () => {
    const batch = new ImportBatch({
      ...makeImportBatch(),
      createdAt: new Date('2024-02-03T10:00:00.000Z'),
      columnMapping: {
        NHC: 'nhc', Nombre: 'patientName', Teléfono: 'phone', Email: 'email', Documento: 'idDocument',
        Sangre: 'bloodType', Dirección: 'address', Contacto: 'emergencyContactName',
        ContactoTel: 'emergencyContactPhone', Relación: 'emergencyContactRelationship', Notas: 'notes',
        Diagnóstico: 'diagnosis', Procedimiento: 'procedure',
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
    const processor = makeProcessor(makeBatchRepo(batch), patientRepo, makeCache([{
      NHC: '123', Nombre: 'Ana Garcia', Teléfono: '666111222', Email: 'ana@example.com', Documento: '12345678Z',
      Sangre: 'A+', Dirección: 'Calle Mayor', Contacto: 'Luis', ContactoTel: '677222333', Relación: 'Cónyuge',
      Notas: 'Importada', Diagnóstico: 'rinitis', Procedimiento: 'endoscopia',
    }]));

    await expect(processor.handleFinalize({
      data: { batchId: 'batch-1', organizationId: 'org-1', userId: 'user-1', matchResolutions: {} },
    } as any)).resolves.toEqual({ created: 1, enriched: 0, skipped: 0, discardedRowCount: 0 });

    expect(patientRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      email: 'ana@example.com', idDocument: '12345678Z', bloodType: 'A_POS',
      address: { street: 'Calle Mayor' }, emergencyContact: { name: 'Luis', phone: '677222333', relationship: 'Cónyuge' },
      notes: 'Importada',
    }));
    const importedData = ((patientRepo.enrich as jest.Mock<any>).mock.calls[0][2] as any).importedData['batch-1'];
    expect(importedData.diagnosis).toBe('rinitis');
    expect(importedData.procedure).toBe('endoscopia');
  });

  it('materializes explicit clinical fields into native records, scopes them, and is idempotent on retry', async () => {
    const batch = new ImportBatch({
      ...makeImportBatch(),
      createdAt: new Date('2024-02-03T10:00:00.000Z'),
      columnMapping: {
        NHC: 'nhc', Nombre: 'patientName', Diagnóstico: 'diagnosis', Procedimiento: 'procedure',
        Notas: 'notes', Ingreso: 'admissionDate', Estancia: 'hospitalStayDays', Quirófano: 'surgeryDurationMinutes',
        Consulta: 'consultationDate', Motivo: 'chiefComplaint', Valoracion: 'assessment', Codigos: 'diagnosisCodes',
        Plan: 'plan', Seguimiento: 'followUpDate', NotasSeguimiento: 'followUpNotes', Cirugia: 'surgeryDate',
        EstadoCirugia: 'surgeryStatus', ASA: 'asa', Anestesia: 'anesthesiaType', Tecnica: 'technique',
        Hallazgos: 'findings', Complicaciones: 'complications', PostOp: 'postOpNotes', Resultado: 'outcome',
      },
    });
    const patient = makePatient();
    let patientLookupCount = 0;
    let consultation: any = null;
    let surgery: any = null;
    const patientRepo = {
      findByImportBatchRow: makeMock().mockImplementation(async () => (++patientLookupCount > 1 ? patient : null)),
      findByNhc: makeMock().mockResolvedValue(null),
      findByNhcIncludingDeleted: makeMock().mockResolvedValue(null),
      create: makeMock().mockResolvedValue(patient),
      enrich: makeMock().mockResolvedValue(patient),
    };
    const consultationRepo = {
      findByImportBatchRow: makeMock().mockImplementation(async (_batchId: string, _org: string) => consultation),
      create: makeMock().mockImplementation(async (input: any) => {
        consultation = { id: 'consultation-1', ...input };
        return consultation;
      }),
    };
    const surgeryRepo = {
      findByImportBatchRow: makeMock().mockImplementation(async (_batchId: string, _org: string) => surgery),
      create: makeMock().mockImplementation(async (input: any) => {
        surgery = { id: 'surgery-1', ...input };
        return surgery;
      }),
    };
    const processor = new ImportProcessor(
      makeBatchRepo(batch) as any,
      patientRepo as any,
      new DataCleanerService(),
      makeCache([{
         NHC: '123', Nombre: 'Ana Garcia', Diagnóstico: 'Rinitis', Procedimiento: 'Septoplastia',
         Notas: 'Importada', Ingreso: '2999-01-01', Estancia: '3 días', Quirófano: '138 min',
         Consulta: '2024-02-01', Motivo: 'Dolor nasal', Valoracion: 'Rinitis', Codigos: 'R51 pendiente de validar',
         Plan: 'Tratamiento conservador', Seguimiento: '2024-02-10', NotasSeguimiento: 'Revisar evolución',
         Cirugia: '2024-02-02', EstadoCirugia: 'completada', ASA: 'ASA III', Anestesia: 'General',
         Tecnica: 'Endoscópica', Hallazgos: 'Sin hallazgos', Complicaciones: 'Ninguna', PostOp: 'Buena evolución', Resultado: 'Alta',
      }]) as any,
      undefined,
      undefined,
      consultationRepo as any,
      surgeryRepo as any,
    );

    await expect(processor.handleFinalize({
      data: { batchId: 'batch-1', organizationId: 'org-1', userId: 'user-1', matchResolutions: {} },
    } as any)).resolves.toEqual(expect.objectContaining({
      created: 1,
      consultationsCreated: 1,
      surgeriesCreated: 1,
    }));

    expect(consultationRepo.findByImportBatchRow).toHaveBeenCalledWith('batch-1', 'org-1', 0);
    expect(surgeryRepo.findByImportBatchRow).toHaveBeenCalledWith('batch-1', 'org-1', 0);
    expect(consultation).toEqual(expect.objectContaining({
       organizationId: 'org-1', patientId: patient.id, date: new Date('2024-02-01T00:00:00.000Z'),
       chiefComplaint: 'Dolor nasal', assessment: 'Rinitis', plan: 'Tratamiento conservador',
       followUpDate: new Date('2024-02-10T00:00:00.000Z'), followUpNotes: 'Revisar evolución',
       physicalExam: { importAuditLog: [expect.objectContaining({
         importBatchId: 'batch-1', importRowIndex: 0,
         importedFields: expect.objectContaining({ diagnosisCodes: 'R51 pendiente de validar' }),
       })] },
    }));
    expect(surgery).toEqual(expect.objectContaining({
       organizationId: 'org-1', patientId: patient.id, date: new Date('2024-02-02T00:00:00.000Z'),
       procedureType: 'Septoplastia', status: 'COMPLETED', asa: 'ASA_III', anesthesiaType: 'General',
       technique: { importedText: 'Endoscópica' }, findings: 'Sin hallazgos', complications: 'Ninguna',
       postOpNotes: 'Buena evolución', outcome: 'Alta',
      duration: 138,
      auditLog: [expect.objectContaining({ importBatchId: 'batch-1', importRowIndex: 0 })],
    }));
    const importedData = ((patientRepo.enrich as jest.Mock<any>).mock.calls[0][2] as any).importedData['batch-1'];
    expect(importedData.hospitalStayDays).toBe('3 días');
    expect(importedData.surgeryDurationMinutes).toBe('138 min');
    expect(consultation.currentIllness).toContain('Tiempo de hospitalización: 3 días');
    expect(surgery.preOpNotes).toContain('Tiempo quirúrgico: 138 minutos');

    const retry = await processor.handleFinalize({
      data: { batchId: 'batch-1', organizationId: 'org-1', userId: 'user-1', matchResolutions: {} },
    } as any);
    expect(retry).toEqual(expect.objectContaining({ created: 0, enriched: 0, consultationsCreated: 0, surgeriesCreated: 0 }));
    expect(consultationRepo.create).toHaveBeenCalledTimes(1);
    expect(surgeryRepo.create).toHaveBeenCalledTimes(1);
  });

  it('keeps invalid numeric clinical values in provenance without native duration', async () => {
    const batch = new ImportBatch({
      ...makeImportBatch(),
      columnMapping: {
        NHC: 'nhc', Nombre: 'patientName', Procedimiento: 'procedure', Quirófano: 'surgeryDurationMinutes',
        Estado: 'surgeryStatus', ASA: 'asa',
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
    const surgeryRepo = {
      findByImportBatchRow: makeMock().mockResolvedValue(null),
      create: makeMock().mockResolvedValue({}),
    };
    const processor = new ImportProcessor(
      makeBatchRepo(batch) as any,
      patientRepo as any,
      new DataCleanerService(),
       makeCache([{ NHC: '123', Nombre: 'Ana Garcia', Procedimiento: 'Septoplastia', Quirófano: 'una hora', Estado: 'completada?', ASA: 'ASA VII' }]) as any,
      undefined,
      undefined,
      undefined,
      surgeryRepo as any,
    );

    await expect(processor.handleFinalize({
      data: { batchId: 'batch-1', organizationId: 'org-1', userId: 'user-1', matchResolutions: {} },
    } as any)).resolves.toEqual(expect.objectContaining({ created: 1, surgeriesCreated: 1 }));

    expect(surgeryRepo.create).toHaveBeenCalledWith(expect.objectContaining({ duration: null, status: 'SCHEDULED', asa: null }));
    const importedData = ((patientRepo.enrich as jest.Mock<any>).mock.calls[0][2] as any).importedData['batch-1'];
    expect(importedData.surgeryDurationMinutes).toBe('una hora');
    expect(importedData.surgeryStatus).toBe('completada?');
    expect(importedData.asa).toBe('ASA VII');
  });

  it('passes address and emergency contact to existing-patient enrichment', async () => {
    const batch = new ImportBatch({
      ...makeImportBatch(),
      columnMapping: {
        NHC: 'nhc', Nombre: 'patientName', Dirección: 'address', Contacto: 'emergencyContactName',
        ContactoTel: 'emergencyContactPhone', Relación: 'emergencyContactRelationship',
      },
    });
    const existing = makePatient();
    const patientRepo = {
      findByNhc: makeMock().mockResolvedValue(existing),
      findByNhcIncludingDeleted: makeMock(),
      create: makeMock(),
      enrich: makeMock().mockResolvedValue(existing),
      findByImportBatchRow: makeMock().mockResolvedValue(null),
    };
    const processor = makeProcessor(makeBatchRepo(batch), patientRepo, makeCache([{
      NHC: '123', Nombre: 'Ana Garcia', Dirección: 'Calle Mayor', Contacto: 'Luis',
      ContactoTel: '677222333', Relación: 'Cónyuge',
    }]));

    await expect(processor.handleFinalize({
      data: { batchId: 'batch-1', organizationId: 'org-1', userId: 'user-1', matchResolutions: {} },
    } as any)).resolves.toEqual({ created: 0, enriched: 1, skipped: 0, discardedRowCount: 0 });

    expect(patientRepo.enrich).toHaveBeenCalledWith(
      existing.id,
      'org-1',
      expect.objectContaining({
        address: { street: 'Calle Mayor' },
        emergencyContact: { name: 'Luis', phone: '677222333', relationship: 'Cónyuge' },
      }),
      'user-1',
    );
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
