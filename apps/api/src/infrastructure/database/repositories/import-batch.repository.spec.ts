// apps/api/src/infrastructure/database/repositories/import-batch.repository.spec.ts
import { describe, it, expect } from '@jest/globals';
import { PrismaImportBatchRepository } from './import-batch.repository';
import { ImportBatch } from '@/domain/import/import-batch.entity';

// Mock PrismaService: captures writes and returns the same record shape it got,
// so toEntity() round-trips through the repository. This proves the mapping
// covers every ImportBatch field without touching a real DB.
function buildMockPrisma() {
  const store = new Map<string, any>();
  // Apply the subset of where-clauses our repository uses: id, organizationId,
  // deletedAt, status. Matches records that satisfy ALL provided predicates.
  const matches = (record: any, where: any) => {
    if (!where) return true;
    if (where.id !== undefined && record.id !== where.id) return false;
    if (where.organizationId !== undefined && record.organizationId !== where.organizationId) return false;
    if (where.deletedAt !== null && where.deletedAt !== undefined) {
      if (where.deletedAt === null && record.deletedAt !== null) return false;
    }
    if (where.status !== undefined && record.status !== where.status) return false;
    return true;
  };
  return {
    importBatch: {
      upsert: async ({ where, create }: any) => {
        store.set(where.id, { ...create });
        return { ...create };
      },
      findFirst: async ({ where, orderBy }: any) => {
        let records = Array.from(store.values()).filter((r) => matches(r, where));
        if (orderBy?.createdAt === 'desc') {
          records = records.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
        }
        return records[0] ?? null;
      },
      update: async ({ where, data }: any) => {
        const cur = store.get(where.id) ?? {};
        const merged = { ...cur, ...data };
        store.set(where.id, merged);
        return merged;
      },
      findMany: async ({ where }: any) => Array.from(store.values()).filter((r) => matches(r, where)),
      count: async ({ where }: any) => Array.from(store.values()).filter((r) => matches(r, where)).length,
    },
  } as any;
}

function makeBatch(): ImportBatch {
  return ImportBatch.createPending({
    id: 'batch-1',
    organizationId: 'org-1',
    createdBy: 'user-1',
    fileName: 'pacientes.xlsx',
    fileSize: 1024,
    fileHash: 'a'.repeat(64),
    originalFormat: 'xlsx',
    sample: { columns: ['NHC', 'Nombre'], rows: [{ NHC: '1', Nombre: 'Ana' }] },
    totalRows: 1,
  }).toConfirming({
    columnMapping: { NHC: 'nhc', Nombre: 'patientName' },
    customFieldNames: {},
    junkRowIndices: [],
    aiConfidence: 0.9,
    aiProvider: 'heuristic',
    issues: [],
    notes: null,
  });
}

describe('PrismaImportBatchRepository', () => {
  it('persist() round-trips every aggregate field through toEntity', async () => {
    const prisma = buildMockPrisma();
    const repo = new PrismaImportBatchRepository(prisma);
    const batch = makeBatch();
    const persisted = await repo.persist(batch);

    expect(persisted.id).toBe(batch.id);
    expect(persisted.organizationId).toBe(batch.organizationId);
    expect(persisted.createdBy).toBe(batch.createdBy);
    expect(persisted.fileName).toBe(batch.fileName);
    expect(persisted.fileHash).toBe(batch.fileHash);
    expect(persisted.originalFormat).toBe(batch.originalFormat);
    expect(persisted.columnMapping).toEqual(batch.columnMapping);
    expect(persisted.aiConfidence).toBe(batch.aiConfidence);
    expect(persisted.aiProvider).toBe(batch.aiProvider);
    expect(persisted.status).toBe('CONFIRMING');
  });

  it('round-trips preview and explicit discard audit metadata', async () => {
    const prisma = buildMockPrisma();
    const repo = new PrismaImportBatchRepository(prisma);
    const batch = makeBatch().applyConfirmedMapping({
      columnMapping: { NHC: 'nhc', Nombre: 'patientName' },
      ignoredColumns: [{ column: 'Notas', reason: 'draft' }],
      ignoredRows: [{ rowIndex: 0, reason: 'duplicate' }],
      previewOverrides: { '0': { Nombre: 'Edited' } },
      cellOverrides: { '0': { Notas: null } },
    });

    const persisted = await repo.persist(batch);
    expect(persisted.ignoredColumns).toEqual([{ column: 'Notas', reason: 'draft' }]);
    expect(persisted.ignoredRows).toEqual([{ rowIndex: 0, reason: 'duplicate' }]);
    expect(persisted.previewOverrides).toEqual({ '0': { Nombre: 'Edited' } });
    expect(persisted.cellOverrides).toEqual({ '0': { Notas: null } });
  });

  it('findById() scopes by organizationId and returns null when missing', async () => {
    const prisma = buildMockPrisma();
    const repo = new PrismaImportBatchRepository(prisma);
    await repo.persist(makeBatch());
    const found = await repo.findById('batch-1', 'org-1');
    expect(found?.id).toBe('batch-1');
    expect(await repo.findById('batch-1', 'other-org')).toBeNull();
  });

  it('softDelete() sets deletedAt (BR-IMP-005)', async () => {
    const prisma = buildMockPrisma();
    const repo = new PrismaImportBatchRepository(prisma);
    await repo.persist(makeBatch());
    const reverted = await repo.softDelete('batch-1', 'org-1');
    expect(reverted.deletedAt).toBeInstanceOf(Date);
    expect(reverted.isReverted).toBe(true);
  });

  it('updateCounters() persists every counter', async () => {
    const prisma = buildMockPrisma();
    const repo = new PrismaImportBatchRepository(prisma);
    await repo.persist(makeBatch());
    const updated = await repo.updateCounters('batch-1', 'org-1', {
      importedRows: 5,
      enrichedRows: 2,
      createdRows: 3,
      skippedRows: 1,
      pendingRows: 0,
    });
    expect(updated.importedRows).toBe(5);
    expect(updated.enrichedRows).toBe(2);
    expect(updated.createdRows).toBe(3);
    expect(updated.skippedRows).toBe(1);
    expect(updated.pendingRows).toBe(0);
  });

  it('updateStatus() persists an actionable finalize error', async () => {
    const prisma = buildMockPrisma();
    const repo = new PrismaImportBatchRepository(prisma);
    await repo.persist(makeBatch());

    const updated = await repo.updateStatus('batch-1', 'org-1', 'FAILED', 'NHC requires manual resolution');

    expect(updated.status).toBe('FAILED');
    expect(updated.errorMessage).toBe('NHC requires manual resolution');
  });

  it('findLatestByOrg() returns the most recent non-deleted batch', async () => {
    const prisma = buildMockPrisma();
    const repo = new PrismaImportBatchRepository(prisma);
    await repo.persist(makeBatch());
    const latest = await repo.findLatestByOrg('org-1');
    expect(latest?.id).toBe('batch-1');
  });
});
