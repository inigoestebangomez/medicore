// apps/api/src/domain/import/import-batch.entity.spec.ts
import { describe, it, expect } from '@jest/globals';
import { ImportBatch } from './import-batch.entity';
import { InvalidImportTransitionError } from './errors/invalid-import-transition.error';
import { ImportAlreadyFinalizedError } from './errors/import-already-finalized.error';
import type { FileSample } from '@medicore/contracts';

const sample: FileSample = { columns: ['NHC', 'Nombre'], rows: [{ NHC: '1', Nombre: 'foo' }] };

function makeBatch(overrides: Partial<{ status: any }> = {}): ImportBatch {
  return new ImportBatch({
    id: 'b-1',
    organizationId: 'org-1',
    createdBy: 'user-1',
    fileName: 'f.xlsx',
    fileSize: 10,
    fileHash: 'hash',
    originalFormat: 'xlsx',
    sample,
    columnMapping: { NHC: 'nhc' },
    totalRows: 5,
    status: overrides.status ?? 'PENDING',
  });
}

describe('ImportBatch entity', () => {
  describe('createPending factory', () => {
    it('should create a batch with status PENDING and aiConfidence null', () => {
      const batch = ImportBatch.createPending({
        id: 'b-1', organizationId: 'o', createdBy: 'u',
        fileName: 'f.xlsx', fileSize: 10, fileHash: 'h',
        originalFormat: 'xlsx', sample, totalRows: 5,
      });
      expect(batch.status).toBe('PENDING');
      expect(batch.aiConfidence).toBeNull();
      expect(batch.importedRows).toBe(0);
    });
  });

  describe('toConfirming (Stage 2)', () => {
    it('should transition PENDING → CONFIRMING with mapping', () => {
      const batch = makeBatch();
      const confirming = batch.toConfirming({
        columnMapping: { NHC: 'nhc', Nombre: 'patientName' },
        aiConfidence: 0.9,
        aiProvider: 'heuristic',
      });
      expect(confirming.status).toBe('CONFIRMING');
      expect(confirming.aiConfidence).toBe(0.9);
    });

    it('should allow updating proposal while already CONFIRMING', () => {
      const confirming = makeBatch().toConfirming({ columnMapping: { NHC: 'nhc' }, aiConfidence: 0.5 });
      const updated = confirming.toConfirming({ columnMapping: { NHC: 'nhc' }, aiConfidence: 0.8 });
      expect(updated.status).toBe('CONFIRMING');
      expect(updated.aiConfidence).toBe(0.8);
    });
  });

  describe('startProcessing + complete (Stage 5)', () => {
    it('should transition CONFIRMING → PROCESSING with snapshot', () => {
      const processing = makeBatch({ status: 'CONFIRMING' }).startProcessing({ 'p-1': { birthDate: '1980' } });
      expect(processing.status).toBe('PROCESSING');
      expect(processing.snapshot).not.toBeNull();
    });

    it('should transition PROCESSING → COMPLETED with counters and completedAt', () => {
      const done = makeBatch({ status: 'PROCESSING' }).complete({
        importedRows: 3, enrichedRows: 1, createdRows: 2, skippedRows: 1, pendingRows: 0,
      });
      expect(done.status).toBe('COMPLETED');
      expect(done.completedAt).toBeInstanceOf(Date);
      expect(done.createdRows).toBe(2);
    });
  });

  describe('invalid transitions', () => {
    it('should throw InvalidImportTransitionError on PENDING → COMPLETED', () => {
      expect(() => makeBatch().complete({ importedRows: 0, enrichedRows: 0, createdRows: 0, skippedRows: 0, pendingRows: 0 }))
        .toThrow(InvalidImportTransitionError);
    });

    it('should throw ImportAlreadyFinalizedError when completing an already COMPLETED batch', () => {
      const done = makeBatch({ status: 'COMPLETED' });
      expect(() => done.startProcessing({}))
        .toThrow(ImportAlreadyFinalizedError);
    });
  });

  describe('fail', () => {
    it('should transition PENDING → FAILED with error message', () => {
      const failed = makeBatch().fail('boom');
      expect(failed.status).toBe('FAILED');
      expect(failed.errorMessage).toBe('boom');
    });

    it('should be idempotent when already FAILED', () => {
      const failed = makeBatch({ status: 'FAILED' });
      expect(failed.fail('again')).toBe(failed);
    });
  });

  describe('revert (BR-IMP-005)', () => {
    it('should soft-delete a COMPLETED batch', () => {
      const reverted = makeBatch({ status: 'COMPLETED' }).revert();
      expect(reverted.deletedAt).toBeInstanceOf(Date);
      expect(reverted.isReverted).toBe(true);
    });

    it('should reject revert from non-terminal status', () => {
      expect(() => makeBatch().revert()).toThrow(InvalidImportTransitionError);
    });
  });

  describe('tier limit (BR-IMP-006)', () => {
    it('should be within tier limit when rows <= tier max', () => {
      const batch = makeBatch(); // totalRows 5
      expect(batch.isWithinTierLimit(500)).toBe(true);
      expect(batch.isWithinTierLimit(3)).toBe(false);
    });
  });

  describe('hasOnlyJunkRows', () => {
    it('should be true when skippedRows === totalRows and rows > 0', () => {
      const batch = makeBatch(); // totalRows 5, skippedRows 0
      const junked = new ImportBatch({ ...batch, skippedRows: 5 });
      expect(junked.hasOnlyJunkRows).toBe(true);
    });

    it('should be false when some rows were imported', () => {
      const batch = new ImportBatch({ ...makeBatch(), totalRows: 5, importedRows: 2, skippedRows: 3 });
      expect(batch.hasOnlyJunkRows).toBe(false);
    });
  });
});