// apps/api/src/api/import/import.controller.spec.ts
// Controller-level unit tests. Guards and the FileInterceptor are not in scope
// here (the app.module spec proves the full DI graph compiles); these tests
// cover the handler-delegation and domain-error → HTTP mapping logic with
// stubbed handlers.

import { describe, it, expect } from '@jest/globals';
import { ImportController } from './import.controller';
import { ImportBatchNotFoundError } from '@/domain/import/errors/import-batch-not-found.error';
import { FileEmptyError } from '@/domain/import/errors/file-empty.error';
import { InvalidImportTransitionError } from '@/domain/import/errors/invalid-import-transition.error';
import { ImportNhcConflictError } from '@/domain/import/errors/import-nhc-conflict.error';
import { ImportReminderService } from '@/application/import/services/import-reminder.service';
import type { JwtPayload } from '@medicore/contracts';

const user: JwtPayload = { sub: 'u-1', organizationId: 'org-1', email: 'a@b.c', role: 'PHYSICIAN' } as any;

// Build a controller with stubbed handlers. We import the real class via a
// thin re-export below to avoid the @nestjs FileInterceptor metadata issue
// in a pure unit context.
function buildController(stubs: {
  parse?: any; analyze?: any; confirm?: any; revert?: any; history?: any;
  batchRepo?: any; queue?: { add: jest.Mock }; reminder?: any;
}) {
  const queue = stubs.queue ?? { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
  const ctrl = new ImportController(
    stubs.batchRepo ?? {
      findById: jest.fn().mockResolvedValue({
        status: 'CONFIRMING',
        pendingRows: 0,
        canTransitionTo: () => true,
      }),
    },
    stubs.parse ?? { execute: jest.fn().mockResolvedValue({ batchId: 'b-1' }) },
    stubs.analyze ?? { execute: jest.fn().mockResolvedValue({ batchId: 'b-1' }) },
    stubs.confirm ?? { execute: jest.fn().mockResolvedValue({ batchId: 'b-1', matches: [] }) },
    stubs.revert ?? { execute: jest.fn().mockResolvedValue({ reverted: true, affectedPatients: 0 }) },
    stubs.history ?? { execute: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }) },
    stubs.reminder ?? { evaluate: jest.fn().mockResolvedValue({ organizationId: 'org-1', showBanner: true }) },
    queue,
  );
  return { ctrl, queue };
}

describe('ImportController', () => {
  it('upload delegates to ParseFileHandler and returns data', async () => {
    const { ctrl } = buildController({ parse: { execute: jest.fn().mockResolvedValue({ batchId: 'b-1', totalRows: 5 }) } });
    const res = await ctrl.upload({ buffer: Buffer.from('x'), originalname: 'f.csv', mimetype: 'text/csv' } as any, user);
    expect(res.data.batchId).toBe('b-1');
  });

  it('upload maps FileEmptyError → 400 BadRequestException', async () => {
    const { ctrl } = buildController({ parse: { execute: jest.fn().mockRejectedValue(new FileEmptyError('empty')) } });
    await expect(ctrl.upload({ buffer: Buffer.alloc(0), originalname: 'f.csv' } as any, user))
      .rejects.toThrow('empty');
  });

  it('upload rejects when no file is provided', async () => {
    const { ctrl } = buildController({});
    await expect(ctrl.upload(null as any, user)).rejects.toThrow();
  });

  it('finalize enqueues the BullMQ job and returns PROCESSING', async () => {
    const { ctrl, queue } = buildController({});
    const res = await ctrl.finalize('b-1', { matchResolutions: { '0': 'auto' } }, user);
    expect(res.data.status).toBe('PROCESSING');
    expect(queue.add).toHaveBeenCalledWith('finalize', expect.objectContaining({ batchId: 'b-1', organizationId: 'org-1' }));
  });

  it('allows retrying a failed finalize without treating it as a new import', async () => {
    const batchRepo = {
      findById: jest.fn().mockResolvedValue({ status: 'FAILED', pendingRows: 0 }),
    };
    const { ctrl, queue } = buildController({ batchRepo });
    const res = await ctrl.finalize('b-1', { matchResolutions: {} }, user);
    expect(res.data.status).toBe('PROCESSING');
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('blocks finalize when unresolved import rows remain', async () => {
    const batchRepo = {
      findById: jest.fn().mockResolvedValue({ status: 'CONFIRMING', pendingRows: 2 }),
    };
    const { ctrl, queue } = buildController({ batchRepo });

    await expect(ctrl.finalize('b-1', { matchResolutions: {} }, user))
      .rejects.toThrow('Resolve the 2 pending import rows before finalizing');
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('revert delegates to RevertImportHandler', async () => {
    const { ctrl } = buildController({ revert: { execute: jest.fn().mockResolvedValue({ reverted: true, affectedPatients: 3 }) } });
    const res = await ctrl.revert('b-1', user);
    expect(res.data.affectedPatients).toBe(3);
  });

  it('revert maps InvalidImportTransitionError → 409 ConflictException', async () => {
    const { ctrl } = buildController({ revert: { execute: jest.fn().mockRejectedValue(new InvalidImportTransitionError('CONFIRMING', 'FAILED')) } });
    await expect(ctrl.revert('b-1', user)).rejects.toThrow();
  });

  it('reanalyze maps ImportBatchNotFoundError → 404 NotFoundException', async () => {
    const { ctrl } = buildController({ analyze: { execute: jest.fn().mockRejectedValue(new ImportBatchNotFoundError('x')) } });
    await expect(ctrl.reanalyze('x', user)).rejects.toThrow();
  });

  it('maps an NHC conflict to a useful 409 response', async () => {
    const { ctrl } = buildController({
      analyze: { execute: jest.fn().mockRejectedValue(new ImportNhcConflictError('123', 'soft-deleted')) },
    });

    await expect(ctrl.reanalyze('b-1', user)).rejects.toThrow('paciente eliminado');
  });

  it('confirm requires columnMapping', async () => {
    const { ctrl } = buildController({});
    await expect(ctrl.confirm('b-1', {} as any, user)).rejects.toThrow();
  });

  it('confirm exposes named mapping conflicts to the API caller', async () => {
    const { ctrl } = buildController({});

    try {
      await ctrl.confirm('b-1', {
        columnMapping: { Nombre: 'patientName', 'Nº Paciente': 'patientName' },
      } as any, user);
      throw new Error('expected mapping conflict');
    } catch (error: any) {
      expect(error.response.mappingConflicts[0].columns).toEqual(['Nombre', 'Nº Paciente']);
    }
  });

  it('list delegates to GetImportHistoryHandler with pagination', async () => {
    const { ctrl } = buildController({ history: { execute: jest.fn().mockResolvedValue({
      items: [{ status: 'FAILED', errorMessage: 'connection failed', ignoredRows: [{ rowIndex: 3 }] }], total: 1, page: 2, pageSize: 5,
    }) } });
    const res = await ctrl.list('2', '5', undefined, user);
    expect(res.data.page).toBe(2);
    expect(res.data.items[0]).toMatchObject({ status: 'FAILED', errorMessage: 'connection failed' });
    expect(res.data.items[0].discardedRowCount).toBe(1);
  });

  it('getOne returns the batch or 404', async () => {
    const { ctrl } = buildController({ batchRepo: { findById: jest.fn().mockResolvedValue({
      id: 'b-1', status: 'PROCESSING', errorMessage: null,
    }) } });
    const res = await ctrl.getOne('b-1', user);
    expect(res.data).toMatchObject({ id: 'b-1', status: 'PROCESSING', errorMessage: null });

    const { ctrl: ctrl2 } = buildController({ batchRepo: { findById: jest.fn().mockResolvedValue(null) } });
    await expect(ctrl2.getOne('missing', user)).rejects.toThrow();
  });

  it('returns paginated preview rows with real zero-based indices', async () => {
    const { ctrl } = buildController({ batchRepo: { findById: jest.fn().mockResolvedValue({
      id: 'b-1',
      toParsedFile: () => ({
        columns: ['NHC'],
        rows: [{ NHC: 'a' }, { NHC: 'b' }, { NHC: 'c' }],
        sample: { columns: ['NHC'], rows: [{ NHC: 'a' }] },
        totalRows: 3,
        originalFormat: 'csv',
      }),
    }) } });
    const res = await ctrl.preview('b-1', '2', '1', user);
    expect(res.data.rows).toEqual([{ rowIndex: 1, values: { NHC: 'b' } }]);
    expect(res.data.page).toBe(2);
  });

  it('returns an actionable error when normalized preview rows are unavailable', async () => {
    const { ctrl } = buildController({ batchRepo: { findById: jest.fn().mockResolvedValue({
      id: 'old-1', toParsedFile: () => null,
    }) } });
    await expect(ctrl.preview('old-1', '1', '50', user))
      .rejects.toThrow('Vuelve a subir el archivo para continuar');
  });

  it('reminderStatus delegates to ImportReminderService', async () => {
    const reminder = { evaluate: jest.fn().mockResolvedValue({ organizationId: 'org-1', showBanner: true, daysSinceLastImport: 18, reminderDays: 15 }) };
    const { ctrl } = buildController({ reminder });
    const res = await ctrl.reminderStatus(user);
    expect(reminder.evaluate).toHaveBeenCalledWith('org-1');
    expect(res.data.showBanner).toBe(true);
  });
});

void ImportReminderService;
