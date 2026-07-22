// apps/api/src/api/research/research.controller.spec.ts
// Controller-level unit tests. Guards are out of scope (the full DI graph is
// proven by the app.module compilation); these cover handler delegation and
// domain-error → HTTP mapping with stubbed handlers/repos.

import { describe, it, expect } from '@jest/globals';
import { ResearchController } from './research.controller';
import { ResearchQueryNotFoundError } from '@/domain/research/errors/research-query-not-found.error';
import { CollectionNotFoundError } from '@/domain/research/errors/collection-not-found.error';
import { CollectionLockedError } from '@/domain/research/errors/collection-locked.error';
import { ResearchQuery } from '@/domain/research/research-query.entity';
import { PatientCollection } from '@/domain/research/patient-collection.entity';
import type { JwtPayload } from '@medicore/contracts';

const user: JwtPayload = {
  sub: 'u-1',
  organizationId: 'org-1',
  email: 'a@b.c',
  role: 'PHYSICIAN',
} as unknown as JwtPayload;

function buildController(stubs: {
  save?: any;
  history?: any;
  execute?: any;
  createCollection?: any;
  addMember?: any;
  lock?: any;
  export?: any;
  queryRepo?: any;
  collectionRepo?: any;
}) {
  const ctrl = new ResearchController(
    stubs.queryRepo ?? {},
    stubs.collectionRepo ?? {},
    stubs.save ?? { execute: jest.fn().mockResolvedValue({ id: 'q-1' }) },
    stubs.history ?? { execute: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }) },
    stubs.execute ?? { execute: jest.fn().mockResolvedValue({ queryId: 'q-1', totalRows: 0, rows: [], stats: [], distributions: [] }) },
    stubs.createCollection ?? { execute: jest.fn().mockResolvedValue({ id: 'c-1', patientCount: 0 }) },
    stubs.addMember ?? { execute: jest.fn().mockResolvedValue({ collectionId: 'c-1', patientCount: 1, addedCount: 1 }) },
    stubs.lock ?? { execute: jest.fn().mockResolvedValue({ collectionId: 'c-1', isLocked: true, patientCount: 1 }) },
    stubs.export ?? {
      execute: jest.fn().mockResolvedValue({
        format: 'csv', mimeType: 'text/csv', filename: 'x.csv',
        content: 'subject_id,age\nSUBJ-abc,60', anonymized: true,
      }),
    },
  );
  return { ctrl };
}

describe('ResearchController', () => {
  // ── Saved queries ──

  it('POST queries delegates to SaveQueryHandler', async () => {
    const save = { execute: jest.fn().mockResolvedValue({ id: 'q-9', name: 'X' }) };
    const { ctrl } = buildController({ save });
    const res = await ctrl.saveQuery(
      { name: 'X', dataSource: 'all_patients', filters: [], filterLogic: 'AND', displayFields: ['age'], visualizations: ['table'] },
      user,
    );
    expect(save.execute).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1', createdBy: 'u-1' }));
    expect(res.data.id).toBe('q-9');
  });

  it('POST queries rejects when name missing', async () => {
    const { ctrl } = buildController({});
    await expect(ctrl.saveQuery({ name: '' } as any, user)).rejects.toThrow();
  });

  it('POST queries maps ResearchQueryNotFoundError → 404', async () => {
    const { ctrl } = buildController({
      save: { execute: jest.fn().mockRejectedValue(new ResearchQueryNotFoundError('q-x')) },
    });
    await expect(
      ctrl.saveQuery({ id: 'q-x', name: 'X', dataSource: 'all_patients', filters: [], filterLogic: 'AND', displayFields: [], visualizations: [] }, user),
    ).rejects.toThrow('not found');
  });

  it('GET queries delegates to GetQueryHistoryHandler', async () => {
    const history = { execute: jest.fn().mockResolvedValue({ items: [{ id: 'q-1' }], total: 1, page: 1, pageSize: 20 }) };
    const { ctrl } = buildController({ history });
    const res = await ctrl.listQueries('1', '20', user);
    expect(history.execute).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-1', organizationId: 'org-1' }));
    expect(res.data.total).toBe(1);
  });

  it('GET queries/:id returns the query when visible', async () => {
    const query = ResearchQuery.createPrivate({
      id: 'q-1', organizationId: 'org-1', createdBy: 'u-1', name: 'Q',
      dataSource: 'all_patients', filters: [], filterLogic: 'AND',
      displayFields: ['age'], visualizations: ['table'],
    });
    const { ctrl } = buildController({ queryRepo: { findById: jest.fn().mockResolvedValue(query) } });
    const res = await ctrl.getQuery('q-1', user);
    expect(res.data.id).toBe('q-1');
  });

  it('GET queries/:id hides queries not visible to the caller (BR-RES-001)', async () => {
    const query = ResearchQuery.createPrivate({
      id: 'q-1', organizationId: 'org-1', createdBy: 'other-user', name: 'Q',
      dataSource: 'all_patients', filters: [], filterLogic: 'AND',
      displayFields: ['age'], visualizations: ['table'],
    });
    const { ctrl } = buildController({ queryRepo: { findById: jest.fn().mockResolvedValue(query) } });
    await expect(ctrl.getQuery('q-1', user)).rejects.toThrow('not found'); // 404, not 403 — no info leak
  });

  it('POST queries/:id/execute delegates to ExecuteResearchQueryHandler', async () => {
    const execute = { execute: jest.fn().mockResolvedValue({ queryId: 'q-1', totalRows: 3, rows: [], stats: [], distributions: [] }) };
    const { ctrl } = buildController({ execute });
    const res = await ctrl.executeQuery('q-1', { filters: [] }, user);
    expect(execute.execute).toHaveBeenCalledWith(expect.objectContaining({ queryId: 'q-1', organizationId: 'org-1' }));
    expect(res.data.totalRows).toBe(3);
  });

  it('DELETE queries/:id soft-deletes an existing query', async () => {
    const softDelete = jest.fn().mockResolvedValue(undefined);
    const query = ResearchQuery.createPrivate({
      id: 'q-1', organizationId: 'org-1', createdBy: 'u-1', name: 'Q',
      dataSource: 'all_patients', filters: [], filterLogic: 'AND',
      displayFields: ['age'], visualizations: ['table'],
    });
    const { ctrl } = buildController({ queryRepo: { findById: jest.fn().mockResolvedValue(query), softDelete } });
    const res = await ctrl.deleteQuery('q-1', user);
    expect(softDelete).toHaveBeenCalledWith('q-1', 'org-1');
    expect(res.data.deleted).toBe(true);
  });

  // ── Collections ──

  it('POST collections delegates to CreateCollectionHandler', async () => {
    const createCollection = { execute: jest.fn().mockResolvedValue({ id: 'c-1', patientCount: 5, isLocked: false }) };
    const { ctrl } = buildController({ createCollection });
    const res = await ctrl.createCollection({ name: 'Cohort', queryId: 'q-1' }, user);
    expect(createCollection.execute).toHaveBeenCalledWith(expect.objectContaining({ createdBy: 'u-1' }));
    expect(res.data.patientCount).toBe(5);
  });

  it('POST collections rejects when name missing', async () => {
    const { ctrl } = buildController({});
    await expect(ctrl.createCollection({} as any, user)).rejects.toThrow();
  });

  it('POST collections/:id/members delegates to AddToCollectionHandler', async () => {
    const addMember = { execute: jest.fn().mockResolvedValue({ collectionId: 'c-1', patientCount: 2, addedCount: 1 }) };
    const { ctrl } = buildController({ addMember });
    const res = await ctrl.addMembers('c-1', { patientIds: ['p-1'] }, user);
    expect(addMember.execute).toHaveBeenCalledWith(expect.objectContaining({ collectionId: 'c-1', addedBy: 'u-1' }));
    expect(res.data.addedCount).toBe(1);
  });

  it('POST collections/:id/members maps CollectionLockedError → 403 (BR-RES-003)', async () => {
    const { ctrl } = buildController({
      addMember: { execute: jest.fn().mockRejectedValue(new CollectionLockedError('c-1')) },
    });
    await expect(ctrl.addMembers('c-1', { patientIds: ['p-1'] }, user)).rejects.toThrow();
    try {
      await ctrl.addMembers('c-1', { patientIds: ['p-1'] }, user);
    } catch (e: any) {
      // ForbiddenException → 403
      expect(e.message).toContain('locked');
    }
  });

  it('POST collections/:id/members requires patientIds', async () => {
    const { ctrl } = buildController({});
    await expect(ctrl.addMembers('c-1', { patientIds: [] }, user)).rejects.toThrow();
  });

  it('DELETE collections/:id/members/:patientId delegates to repo.removeMember', async () => {
    const collection = PatientCollection.create({ id: 'c-1', organizationId: 'org-1', createdBy: 'u-1', name: 'C' }).addMembers(['p-1'], 'u-1');
    const collectionRepo = { removeMember: jest.fn().mockResolvedValue(collection) };
    const { ctrl } = buildController({ collectionRepo });
    const res = await ctrl.removeMember('c-1', 'p-1', user);
    expect(collectionRepo.removeMember).toHaveBeenCalledWith('c-1', 'org-1', 'p-1');
    expect(res.data.patientCount).toBe(1);
  });

  it('DELETE members maps CollectionNotFoundError → 404', async () => {
    const collectionRepo = { removeMember: jest.fn().mockRejectedValue(new CollectionNotFoundError('c-x')) };
    const { ctrl } = buildController({ collectionRepo });
    await expect(ctrl.removeMember('c-x', 'p-1', user)).rejects.toThrow('not found');
  });

  it('POST collections/:id/lock delegates to LockCollectionHandler', async () => {
    const lock = { execute: jest.fn().mockResolvedValue({ collectionId: 'c-1', isLocked: true, patientCount: 5 }) };
    const { ctrl } = buildController({ lock });
    const res = await ctrl.lockCollection('c-1', user);
    expect(lock.execute).toHaveBeenCalledWith(expect.objectContaining({ collectionId: 'c-1', lockedBy: 'u-1' }));
    expect(res.data.isLocked).toBe(true);
  });

  // ── Export — BR-RES-002 ──

  it('POST export delegates to ExportResultsHandler and sets Content-Disposition', async () => {
    const setHeader = jest.fn();
    const exp = {
      execute: jest.fn().mockResolvedValue({
        format: 'csv', mimeType: 'text/csv', filename: 'research_q-1.csv',
        content: 'subject_id,age\nSUBJ-abc,60', anonymized: true,
      }),
    };
    const { ctrl } = buildController({ export: exp });
    const res = await ctrl.export({ collectionId: 'c-1', format: 'csv' }, user, { setHeader } as any);
    expect(exp.execute).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1', format: 'csv' }));
    expect(res.data.anonymized).toBe(true); // BR-RES-002 always true
    expect(setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('research_q-1.csv'));
  });

  it('POST export requires format', async () => {
    const { ctrl } = buildController({});
    await expect(ctrl.export({ collectionId: 'c-1' } as any, user, { setHeader: jest.fn() } as any)).rejects.toThrow();
  });

  it('POST export requires collectionId or queryId', async () => {
    const { ctrl } = buildController({});
    await expect(ctrl.export({ format: 'csv' }, user, { setHeader: jest.fn() } as any)).rejects.toThrow();
  });
});