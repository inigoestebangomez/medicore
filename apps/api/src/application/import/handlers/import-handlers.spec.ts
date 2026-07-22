// apps/api/src/application/import/handlers/import-handlers.spec.ts
import { describe, it, expect } from '@jest/globals';
import { FileParserService } from '../services/file-parser.service';
import { DataCleanerService } from '../services/data-cleaner.service';
import { PatientMatcherService } from '../services/patient-matcher.service';
import { InMemoryParsedFileCache } from '../services/in-memory-parsed-file-cache';
import { ImportAnalyzerService } from '../services/import-analyzer.service';
import { ParseFileHandler } from './parse-file.handler';
import { AnalyzeColumnsHandler } from './analyze-columns.handler';
import { ConfirmImportHandler } from './confirm-import.handler';
import { RevertImportHandler } from './revert-import.handler';
import { GetImportHistoryHandler } from './get-import-history.handler';
import { ImportBatch } from '@/domain/import/import-batch.entity';
import type { IImportBatchRepository, UpdateAnalysisInput, UpdateCountersInput, ListImportBatchesParams } from '@/domain/import/import-batch.repository.interface';
import type { ImportStatus, ColumnMapping, FileSample, ColumnMappingProposal } from '@medicore/contracts';
import type { Patient } from '@/domain/patient/patient.entity';

// ─────────────────────────────────────────────
// In-memory doubles
// ─────────────────────────────────────────────

class InMemoryBatchRepo implements IImportBatchRepository {
  public store = new Map<string, ImportBatch>();
  async persist(batch: ImportBatch): Promise<ImportBatch> { this.store.set(batch.id, batch); return batch; }
  async findById(id: string, organizationId: string): Promise<ImportBatch | null> {
    const b = this.store.get(id);
    return b && b.organizationId === organizationId ? b : null;
  }
  async findByOrg(params: ListImportBatchesParams): Promise<{ items: ImportBatch[]; total: number }> {
    const items = Array.from(this.store.values()).filter(
      (b) => b.organizationId === params.organizationId && (!params.status || b.status === params.status),
    );
    return { items: items.slice((params.page - 1) * params.pageSize, params.page * params.pageSize), total: items.length };
  }
  async updateAnalysis(id: string, _organizationId: string, data: UpdateAnalysisInput): Promise<ImportBatch> {
    const cur = this.store.get(id)!;
    const next = new ImportBatch({ ...cur, ...data, status: 'CONFIRMING' });
    this.store.set(id, next);
    return next;
  }
  async updateStatus(id: string, _organizationId: string, status: ImportStatus): Promise<ImportBatch> {
    const cur = this.store.get(id)!;
    const next = new ImportBatch({ ...cur, status, completedAt: status === 'COMPLETED' ? new Date() : cur.completedAt });
    this.store.set(id, next);
    return next;
  }
  async updateCounters(id: string, _organizationId: string, counters: UpdateCountersInput): Promise<ImportBatch> {
    const cur = this.store.get(id)!;
    const next = new ImportBatch({ ...cur, ...counters });
    this.store.set(id, next);
    return next;
  }
  async softDelete(id: string, _organizationId: string): Promise<ImportBatch> {
    const cur = this.store.get(id)!;
    const next = new ImportBatch({ ...cur, deletedAt: new Date() });
    this.store.set(id, next);
    return next;
  }
  async findLatestByOrg(organizationId: string): Promise<ImportBatch | null> {
    const items = Array.from(this.store.values())
      .filter((b) => b.organizationId === organizationId && !b.deletedAt)
      .sort((a, b) => +b.createdAt - +a.createdAt);
    return items[0] ?? null;
  }
}

class StubAnalyzer extends ImportAnalyzerService {
  constructor(public proposal: ColumnMappingProposal, public providerName = 'heuristic') {
    super(null as any, null as any, null as any);
  }
  async analyzeWithFallback(_sample: FileSample) {
    return { proposal: this.proposal, provider: this.providerName, metThreshold: this.proposal.confidence >= 0.7, attempted: [] };
  }
}

class StubMatcher extends PatientMatcherService {
  constructor(public fakeMatches: import('@/domain/import/patient-match.vo').PatientMatchVO[]) {
    super(null as any);
  }
  async match() { return { matches: this.fakeMatches }; }
}

class StubPatientRepo {
  removedBatchCalls: string[] = [];
  async removeImportedBatch(batchId: string) { this.removedBatchCalls.push(batchId); return 2; }
}

// ─────────────────────────────────────────────
// Shared fixture
// ─────────────────────────────────────────────

function xlsxBuffer(): Buffer {
  // Minimal CSV is enough — FileParserService detects .csv by extension.
  const csv = 'Nº HISTORIA,Paciente,Edad\n13046043,ANA GARCIA,45\n';
  return Buffer.from(csv, 'utf8');
}

const proposal: ColumnMappingProposal = {
  columnMapping: { 'Nº HISTORIA': 'nhc', Paciente: 'patientName', Edad: 'age' },
  customFieldNames: {},
  junkRowIndices: [],
  issues: [],
  confidence: 0.9,
  notes: 'ok',
  provider: 'heuristic',
};

function buildHandlers() {
  const batchRepo = new InMemoryBatchRepo();
  const cache = new InMemoryParsedFileCache();
  const parser = new FileParserService();
  const analyzer = new StubAnalyzer(proposal);
  const cleaner = new DataCleanerService();

  const matchVOs = [
    new (require('@/domain/import/patient-match.vo').PatientMatchVO)({ rowIndex: 0, candidateId: 'p-1', score: 100, reason: 'NHC' }),
  ];
  const matcher = new StubMatcher(matchVOs);
  const patientRepo = new StubPatientRepo();

  const parse = new ParseFileHandler(parser, analyzer, batchRepo, cache);
  const reanalyze = new AnalyzeColumnsHandler(analyzer, batchRepo, cache);
  const confirm = new ConfirmImportHandler(batchRepo, cleaner, matcher, cache);
  const revert = new RevertImportHandler(batchRepo, patientRepo as any, cache);
  const history = new GetImportHistoryHandler(batchRepo);

  return { batchRepo, cache, parser, analyzer, cleaner, matcher, patientRepo, parse, reanalyze, confirm, revert, history };
}

// ─────────────────────────────────────────────

describe('Import use cases', () => {
  describe('ParseFileHandler', () => {
    it('creates a CONFIRMING batch with the proposed mapping and caches the parsed file', async () => {
      const { parse, batchRepo, cache } = buildHandlers();
      const res = await parse.execute({
        buffer: xlsxBuffer(),
        fileName: 'pacientes.csv',
        organizationId: 'org-1',
        createdBy: 'user-1',
      });
      expect(res.totalRows).toBe(1);
      expect(res.proposal.columnMapping['Nº HISTORIA']).toBe('nhc');
      const batch = await batchRepo.findById(res.batchId, 'org-1');
      expect(batch?.status).toBe('CONFIRMING');
      expect(batch?.aiProvider).toBe('heuristic');
      const cached = await cache.get(res.batchId, 'org-1');
      expect(cached?.rows.length).toBe(1);
    });
  });

  describe('AnalyzeColumnsHandler', () => {
    it('re-runs the analyzer and updates the batch mapping', async () => {
      const { parse, reanalyze, batchRepo } = buildHandlers();
      const parsed = await parse.execute({
        buffer: xlsxBuffer(), fileName: 'p.csv', organizationId: 'org-1', createdBy: 'u',
      });
      const res = await reanalyze.execute({ batchId: parsed.batchId, organizationId: 'org-1' });
      expect(res.proposal).toEqual(proposal);
      const batch = await batchRepo.findById(parsed.batchId, 'org-1');
      expect(batch?.columnMapping).toEqual(proposal.columnMapping);
    });

    it('throws when the batch does not exist', async () => {
      const { reanalyze } = buildHandlers();
      await expect(reanalyze.execute({ batchId: 'missing', organizationId: 'org-1' })).rejects.toThrow();
    });
  });

  describe('ConfirmImportHandler', () => {
    it('applies the confirmed mapping, cleans, matches, and returns counts', async () => {
      const { parse, confirm } = buildHandlers();
      const parsed = await parse.execute({
        buffer: xlsxBuffer(), fileName: 'p.csv', organizationId: 'org-1', createdBy: 'u',
      });
      const mapping: ColumnMapping = { 'Nº HISTORIA': 'nhc', Paciente: 'patientName', Edad: 'age' };
      const res = await confirm.execute({
        batchId: parsed.batchId, organizationId: 'org-1', columnMapping: mapping,
      });
      expect(res.cleanedRowCount).toBe(1);
      expect(res.matches.length).toBe(1);
      expect(res.autoMatchCount).toBe(1);
    });

    it('returns zero counts on a cache miss (server restart scenario)', async () => {
      const { parse, confirm, cache } = buildHandlers();
      const parsed = await parse.execute({
        buffer: xlsxBuffer(), fileName: 'p.csv', organizationId: 'org-1', createdBy: 'u',
      });
      await cache.delete(parsed.batchId, 'org-1');
      const res = await confirm.execute({
        batchId: parsed.batchId, organizationId: 'org-1',
        columnMapping: { 'Nº HISTORIA': 'nhc' },
      });
      expect(res.cleanedRowCount).toBe(0);
      expect(res.matches).toEqual([]);
    });
  });

  describe('RevertImportHandler (BR-IMP-005)', () => {
    it('soft-deletes the batch, strips importedData from patients, purges the cache', async () => {
      const { parse, confirm, revert, batchRepo, cache, patientRepo } = buildHandlers();
      const parsed = await parse.execute({
        buffer: xlsxBuffer(), fileName: 'p.csv', organizationId: 'org-1', createdBy: 'u',
      });
      await confirm.execute({
        batchId: parsed.batchId, organizationId: 'org-1',
        columnMapping: { 'Nº HISTORIA': 'nhc', Paciente: 'patientName', Edad: 'age' },
      });
      // Simulate a finalized batch (the worker would move it to COMPLETED).
      await batchRepo.updateStatus(parsed.batchId, 'org-1', 'COMPLETED');

      const res = await revert.execute({ batchId: parsed.batchId, organizationId: 'org-1', revertedBy: 'u' });
      expect(res.reverted).toBe(true);
      expect(res.affectedPatients).toBe(2);
      expect(patientRepo.removedBatchCalls).toContain(parsed.batchId);
      expect(await cache.get(parsed.batchId, 'org-1')).toBeNull();
      const after = await batchRepo.findById(parsed.batchId, 'org-1');
      expect(after?.isReverted).toBe(true);
    });

    it('is idempotent — a second revert reports zero new affected patients', async () => {
      const { parse, confirm, revert, batchRepo } = buildHandlers();
      const parsed = await parse.execute({
        buffer: xlsxBuffer(), fileName: 'p.csv', organizationId: 'org-1', createdBy: 'u',
      });
      await confirm.execute({
        batchId: parsed.batchId, organizationId: 'org-1',
        columnMapping: { 'Nº HISTORIA': 'nhc' },
      });
      await batchRepo.updateStatus(parsed.batchId, 'org-1', 'COMPLETED');
      await revert.execute({ batchId: parsed.batchId, organizationId: 'org-1', revertedBy: 'u' });
      const second = await revert.execute({ batchId: parsed.batchId, organizationId: 'org-1', revertedBy: 'u' });
      expect(second.affectedPatients).toBe(0);
    });
  });

  describe('GetImportHistoryHandler', () => {
    it('lists org batches paginated', async () => {
      const { parse, history } = buildHandlers();
      for (let i = 0; i < 3; i++) {
        await parse.execute({ buffer: xlsxBuffer(), fileName: `p${i}.csv`, organizationId: 'org-1', createdBy: 'u' });
      }
      const res = await history.execute({ organizationId: 'org-1', page: 1, pageSize: 2 });
      expect(res.total).toBe(3);
      expect(res.items.length).toBe(2);
      const page2 = await history.execute({ organizationId: 'org-1', page: 2, pageSize: 2 });
      expect(page2.items.length).toBe(1);
    });
  });
});

void (0 as any as Patient); // keep type import referenced without forcing usage
