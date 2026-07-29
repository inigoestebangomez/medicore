// apps/api/src/application/research/research-handlers.spec.ts
import { describe, it, expect } from '@jest/globals';
import { PatientCollection } from '@/domain/research/patient-collection.entity';
import { ResearchQuery } from '@/domain/research/research-query.entity';
import { CollectionLockedError } from '@/domain/research/errors/collection-locked.error';
import { CollectionNotFoundError } from '@/domain/research/errors/collection-not-found.error';
import { ResearchQueryNotFoundError } from '@/domain/research/errors/research-query-not-found.error';
import type { IPatientCollectionRepository, FindCollectionsParams } from '@/domain/research/patient-collection.repository.interface';
import type { IResearchQueryRepository } from '@/domain/research/research-query.repository.interface';
import type { PatientCollection as Coll } from '@/domain/research/patient-collection.entity';
import type { ResearchQuery as RQ } from '@/domain/research/research-query.entity';
import type { Filter } from '@medicore/contracts';

import { SaveQueryHandler } from './commands/save-research-query.handler';
import { CreateCollectionHandler } from './commands/create-collection.handler';
import { AddToCollectionHandler } from './commands/add-to-collection.handler';
import { LockCollectionHandler } from './commands/lock-collection.handler';
import { ExportResultsHandler } from './commands/export-collection.handler';
import { GetQueryHistoryHandler } from './queries/get-query-history.handler';
import { ExecuteResearchQueryHandler } from './queries/execute-research-query.handler';

// ─────────────────────────────────────────────
// In-memory doubles
// ─────────────────────────────────────────────

class InMemoryCollectionRepo implements IPatientCollectionRepository {
  public store = new Map<string, Coll>();

  async save(c: Coll): Promise<Coll> {
    const next = new PatientCollection({ ...c });
    this.store.set(c.id, next);
    return next;
  }
  async findById(id: string, orgId: string): Promise<Coll | null> {
    const c = this.store.get(id);
    return c && c.organizationId === orgId ? c : null;
  }
  async findByOrg(p: FindCollectionsParams) {
    const items = Array.from(this.store.values()).filter(
      (c) => c.organizationId === p.organizationId && !c.deletedAt,
    );
    return {
      items: items.slice((p.page - 1) * p.pageSize, p.page * p.pageSize),
      total: items.length,
    };
  }
  async addMembers(id: string, orgId: string, patientIds: string[], addedBy: string, notes?: string) {
    const c = await this.findById(id, orgId);
    if (!c) throw new CollectionNotFoundError(id);
    const next = c.addMembers(patientIds, addedBy, notes);
    this.store.set(id, next);
    return next;
  }
  async removeMember(id: string, orgId: string, patientId: string) {
    const c = await this.findById(id, orgId);
    if (!c) throw new CollectionNotFoundError(id);
    const next = c.removeMember(patientId);
    this.store.set(id, next);
    return next;
  }
  async lock(id: string, orgId: string) {
    const c = await this.findById(id, orgId);
    if (!c) throw new CollectionNotFoundError(id);
    const next = c.lock();
    this.store.set(id, next);
    return next;
  }
  async softDelete(id: string, orgId: string) {
    const c = await this.findById(id, orgId);
    if (!c) throw new CollectionNotFoundError(id);
    const next = c.delete();
    this.store.set(id, next);
    return next;
  }
  async getMemberCount(id: string, orgId: string) {
    const c = await this.findById(id, orgId);
    return c?.patientCount ?? 0;
  }
}

class InMemoryQueryRepo implements IResearchQueryRepository {
  public store = new Map<string, RQ>();
  async save(q: RQ) { this.store.set(q.id, q); return q; }
  async findById(id: string, orgId: string) {
    const q = this.store.get(id);
    return q && q.organizationId === orgId ? q : null;
  }
  async findByOrg(p: { organizationId: string; userId: string; page: number; pageSize: number }) {
    const items = Array.from(this.store.values()).filter(
      (q) =>
        q.organizationId === p.organizationId &&
        !q.deletedAt &&
        (q.createdBy === p.userId || q.sharedWith.includes(p.userId)),
    );
    return {
      items: items.slice((p.page - 1) * p.pageSize, p.page * p.pageSize),
      total: items.length,
    };
  }
  async update(q: RQ) { this.store.set(q.id, q); return q; }
  async updateRunStats(id: string, _org: string, count: number) {
    const q = this.store.get(id)!;
    const next = new ResearchQuery({ ...q, lastRunAt: new Date(), lastRunCount: count });
    this.store.set(id, next);
    return next;
  }
  async shareWith(id: string, _org: string, userId: string) {
    const q = this.store.get(id)!;
    const next = q.shareWith(userId);
    this.store.set(id, next);
    return next;
  }
  async unshareWith(id: string, _org: string, userId: string) {
    const q = this.store.get(id)!;
    const next = q.unshareWith(userId);
    this.store.set(id, next);
    return next;
  }
  async softDelete(id: string, _org: string) {
    const q = this.store.get(id)!;
    this.store.set(id, new ResearchQuery({ ...q, deletedAt: new Date() }));
    return this.store.get(id)!;
  }
  async updateSharing(id: string, _org: string, sharing: any) {
    const q = this.store.get(id)!;
    const next = q.setSharing(sharing.users ?? [], sharing.permission ?? 'view');
    this.store.set(id, next);
    return next;
  }
  async findSharedWithMe(_org: string, _userId: string) {
    return [];
  }
}

class StubExecuteHandler extends ExecuteResearchQueryHandler {
  constructor(
    public fakeRows: Array<{ patientId: string; nhc: string; fields: Record<string, unknown> }>,
    public fakeStats: any[] = [],
    public fakeDistributions: any[] = [],
    public fakeDisplayFields: string[] = ['age', 'firstName', 'lastName', 'nhc'],
  ) {
    super(null as any, null as any, null as any, null as any, null as any);
  }
  async execute() {
    return {
      queryId: 'q-1',
      totalRows: this.fakeRows.length,
      rows: this.fakeRows,
      stats: this.fakeStats,
      distributions: this.fakeDistributions,
      displayFields: this.fakeDisplayFields,
      appliedFilters: [] as Filter[],
    };
  }
}

const ORG = 'org-1';
const USER = 'user-1';
const OTHER = 'user-2';

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('SaveQueryHandler', () => {
  it('creates a new query private by default (BR-RES-001)', async () => {
    const repo = new InMemoryQueryRepo();
    const handler = new SaveQueryHandler(repo);

    const res = await handler.execute({
      organizationId: ORG,
      createdBy: USER,
      name: 'My cohort',
      dataSource: 'all_patients',
      filters: [],
      filterLogic: 'AND',
      displayFields: ['age', 'sex'],
      visualizations: ['table', 'stats'],
    });

    expect(res.id).toBeTruthy();
    const saved = repo.store.get(res.id)!;
    expect(saved.createdBy).toBe(USER);
    expect(saved.sharedWith).toEqual([]); // BR-RES-001: private by default
  });

  it('updates an existing query by id', async () => {
    const repo = new InMemoryQueryRepo();
    const handler = new SaveQueryHandler(repo);

    const first = await handler.execute({
      organizationId: ORG, createdBy: USER, name: 'A',
      dataSource: 'all_patients', filters: [], filterLogic: 'AND',
      displayFields: ['age'], visualizations: ['table'],
    });

    const updated = await handler.execute({
      queryId: first.id, organizationId: ORG, createdBy: USER, name: 'A-renamed',
      dataSource: 'all_patients', filters: [], filterLogic: 'AND',
      displayFields: ['age', 'sex'], visualizations: ['table', 'stats'],
    });

    expect(updated.id).toBe(first.id);
    expect(repo.store.get(first.id)!.name).toBe('A-renamed');
    expect(repo.store.get(first.id)!.displayFields).toEqual(['age', 'sex']);
  });

  it('throws ResearchQueryNotFoundError when updating a missing id', async () => {
    const repo = new InMemoryQueryRepo();
    const handler = new SaveQueryHandler(repo);
    await expect(
      handler.execute({
        queryId: 'missing', organizationId: ORG, createdBy: USER, name: 'x',
        dataSource: 'all_patients', filters: [], filterLogic: 'AND',
        displayFields: ['age'], visualizations: ['table'],
      }),
    ).rejects.toBeInstanceOf(ResearchQueryNotFoundError);
  });
});

describe('GetQueryHistoryHandler — BR-RES-001', () => {
  it('returns only queries the caller created or that are shared with them', async () => {
    const repo = new InMemoryQueryRepo();
    // Two queries by USER, one by OTHER (shared with USER), one private by OTHER.
    repo.store.set(
      'q-mine-1',
      ResearchQuery.createPrivate({
        id: 'q-mine-1', organizationId: ORG, createdBy: USER, name: 'mine1',
        dataSource: 'all_patients', filters: [], filterLogic: 'AND',
        displayFields: ['age'], visualizations: ['table'],
      }),
    );
    const sharedByOther = ResearchQuery.createPrivate({
      id: 'q-shared', organizationId: ORG, createdBy: OTHER, name: 'shared',
      dataSource: 'all_patients', filters: [], filterLogic: 'AND',
      displayFields: ['age'], visualizations: ['table'],
    }).shareWith(USER);
    repo.store.set('q-shared', sharedByOther);
    repo.store.set(
      'q-other-private',
      ResearchQuery.createPrivate({
        id: 'q-other-private', organizationId: ORG, createdBy: OTHER, name: 'private',
        dataSource: 'all_patients', filters: [], filterLogic: 'AND',
        displayFields: ['age'], visualizations: ['table'],
      }),
    );

    const handler = new GetQueryHistoryHandler(repo);
    const res = await handler.execute({ organizationId: ORG, userId: USER, page: 1, pageSize: 20 });

    const ids = res.items.map((i) => i.id);
    expect(ids).toContain('q-mine-1');
    expect(ids).toContain('q-shared');
    expect(ids).not.toContain('q-other-private'); // BR-RES-001
    expect(res.total).toBe(2);
  });
});

describe('CreateCollectionHandler', () => {
  it('creates a collection from a query result (snapshots patientIds)', async () => {
    const repo = new InMemoryCollectionRepo();
    const exec = new StubExecuteHandler([
      { patientId: 'p-1', nhc: 'NHC1', fields: { age: 60 } },
      { patientId: 'p-2', nhc: 'NHC2', fields: { age: 55 } },
    ]);
    const handler = new CreateCollectionHandler(repo, exec);

    const res = await handler.execute({
      organizationId: ORG, createdBy: USER, name: 'Cohort A', queryId: 'q-1',
    });

    expect(res.patientCount).toBe(2);
    expect(res.queryId).toBe('q-1');
    expect(res.isLocked).toBe(false);
    expect(repo.store.get(res.id)!.hasMember('p-1')).toBe(true);
  });

  it('creates a collection from explicit patientIds', async () => {
    const repo = new InMemoryCollectionRepo();
    const exec = new StubExecuteHandler([]);
    const handler = new CreateCollectionHandler(repo, exec);

    const res = await handler.execute({
      organizationId: ORG, createdBy: USER, name: 'Manual cohort',
      patientIds: ['p-3', 'p-4'],
    });

    expect(res.patientCount).toBe(2);
    expect(res.queryId).toBeNull();
  });

  it('throws when neither queryId nor patientIds given', async () => {
    const repo = new InMemoryCollectionRepo();
    const exec = new StubExecuteHandler([]);
    const handler = new CreateCollectionHandler(repo, exec);
    await expect(
      handler.execute({ organizationId: ORG, createdBy: USER, name: 'empty' }),
    ).rejects.toBeInstanceOf(CollectionNotFoundError);
  });
});

describe('AddToCollectionHandler — BR-RES-003', () => {
  it('adds members to an unlocked collection', async () => {
    const repo = new InMemoryCollectionRepo();
    repo.store.set(
      'col-1',
      PatientCollection.create({ id: 'col-1', organizationId: ORG, createdBy: USER, name: 'C' }),
    );
    const handler = new AddToCollectionHandler(repo);

    const res = await handler.execute({
      collectionId: 'col-1', organizationId: ORG, addedBy: USER,
      patientIds: ['p-1', 'p-2'],
    });

    expect(res.patientCount).toBe(2);
    expect(res.addedCount).toBe(2);
  });

  it('rejects adds to a locked collection (BR-RES-003)', async () => {
    const repo = new InMemoryCollectionRepo();
    repo.store.set(
      'col-locked',
      PatientCollection.create({ id: 'col-locked', organizationId: ORG, createdBy: USER, name: 'C' })
        .addMembers(['p-x'], USER)
        .lock(),
    );
    const handler = new AddToCollectionHandler(repo);

    await expect(
      handler.execute({
        collectionId: 'col-locked', organizationId: ORG, addedBy: USER,
        patientIds: ['p-y'],
      }),
    ).rejects.toBeInstanceOf(CollectionLockedError);
  });

  it('is idempotent — adding existing members reports addedCount=0', async () => {
    const repo = new InMemoryCollectionRepo();
    repo.store.set(
      'col-2',
      PatientCollection.create({ id: 'col-2', organizationId: ORG, createdBy: USER, name: 'C' })
        .addMembers(['p-1'], USER),
    );
    const handler = new AddToCollectionHandler(repo);

    const res = await handler.execute({
      collectionId: 'col-2', organizationId: ORG, addedBy: USER, patientIds: ['p-1'],
    });
    expect(res.patientCount).toBe(1);
    expect(res.addedCount).toBe(0);
  });
});

describe('LockCollectionHandler — BR-RES-003', () => {
  it('locks an unlocked collection', async () => {
    const repo = new InMemoryCollectionRepo();
    repo.store.set(
      'col-3',
      PatientCollection.create({ id: 'col-3', organizationId: ORG, createdBy: USER, name: 'C' }),
    );
    const handler = new LockCollectionHandler(repo);

    const res = await handler.execute({ collectionId: 'col-3', organizationId: ORG, lockedBy: USER });
    expect(res.isLocked).toBe(true);
    expect(repo.store.get('col-3')!.isLocked).toBe(true);
  });

  it('is idempotent on an already-locked collection', async () => {
    const repo = new InMemoryCollectionRepo();
    repo.store.set(
      'col-4',
      PatientCollection.create({ id: 'col-4', organizationId: ORG, createdBy: USER, name: 'C' }).lock(),
    );
    const handler = new LockCollectionHandler(repo);

    const res = await handler.execute({ collectionId: 'col-4', organizationId: ORG, lockedBy: USER });
    expect(res.isLocked).toBe(true);
  });

  it('throws CollectionNotFoundError for a missing collection', async () => {
    const repo = new InMemoryCollectionRepo();
    const handler = new LockCollectionHandler(repo);
    await expect(
      handler.execute({ collectionId: 'nope', organizationId: ORG, lockedBy: USER }),
    ).rejects.toBeInstanceOf(CollectionNotFoundError);
  });
});

describe('ExportResultsHandler — BR-RES-002', () => {
  const rows = [
    { patientId: '550e8400-e29b-41d4-a716-446655440000', nhc: 'NHC001', fields: { age: 60, firstName: 'Juan', lastName: 'Pérez', sex: 'M' } },
    { patientId: '550e8400-e29b-41d4-a716-446655440001', nhc: 'NHC002', fields: { age: 55, firstName: 'Ana', lastName: 'López', sex: 'F' } },
  ];

  function setup() {
    const collRepo = new InMemoryCollectionRepo();
    const queryRepo = new InMemoryQueryRepo();
    // collection linked to a query
    collRepo.store.set(
      'col-q',
      PatientCollection.fromQuery({
        id: 'col-q', organizationId: ORG, createdBy: USER, name: 'C',
        queryId: 'q-1', patientIds: rows.map((r) => r.patientId),
      }),
    );
    queryRepo.store.set(
      'q-1',
      ResearchQuery.createPrivate({
        id: 'q-1', organizationId: ORG, createdBy: USER, name: 'Q',
        dataSource: 'all_patients', filters: [], filterLogic: 'AND',
        displayFields: ['age', 'firstName', 'lastName', 'nhc'], visualizations: ['table'],
      }),
    );
    const exec = new StubExecuteHandler(rows, [], [], ['age', 'firstName', 'lastName', 'nhc']);
    return { collRepo, queryRepo, exec };
  }

  it('CSV never contains real names or NHC — uses anonymized subject_id (BR-RES-002)', async () => {
    const { collRepo, queryRepo, exec } = setup();
    const handler = new ExportResultsHandler(collRepo, queryRepo, exec);

    const res = await handler.execute({
      collectionId: 'col-q', organizationId: ORG, format: 'csv',
    });

    expect(res.format).toBe('csv');
    expect(res.anonymized).toBe(true);
    expect(res.content).not.toContain('Juan');
    expect(res.content).not.toContain('Pérez');
    expect(res.content).not.toContain('Ana');
    expect(res.content).not.toContain('López');
    expect(res.content).not.toContain('NHC001');
    expect(res.content).not.toContain('NHC002');
    // Anonymized subject ids present
    expect(res.content).toContain('SUBJ-');
    // age column kept (non-identifying)
    expect(res.content).toContain('age');
    // firstName/lastName/nhc columns removed from header
    const header = res.content.split('\n')[0];
    expect(header).not.toContain('firstName');
    expect(header).not.toContain('lastName');
    expect(header).not.toContain('nhc');
  });

  it('word_table1 produces a Tabla 1 summary and is anonymized', async () => {
    const { collRepo, queryRepo, exec } = setup();
    const handler = new ExportResultsHandler(collRepo, queryRepo, exec);

    const res = await handler.execute({
      collectionId: 'col-q', organizationId: ORG, format: 'word_table1',
    });

    expect(res.format).toBe('word_table1');
    expect(res.anonymized).toBe(true);
    expect(res.content).toContain('Tabla 1');
  });

  it('throws when exporting a query that does not exist', async () => {
    const collRepo = new InMemoryCollectionRepo();
    const queryRepo = new InMemoryQueryRepo();
    const exec = new StubExecuteHandler(rows);

    const handler = new ExportResultsHandler(collRepo, queryRepo, exec);
    await expect(
      handler.execute({ queryId: 'missing', organizationId: ORG, format: 'csv' }),
    ).rejects.toBeInstanceOf(ResearchQueryNotFoundError);
  });

  it('png_charts returns a structured manifest (frontend renders)', async () => {
    const { collRepo, queryRepo, exec } = setup();
    const handler = new ExportResultsHandler(collRepo, queryRepo, exec);

    const res = await handler.execute({
      collectionId: 'col-q', organizationId: ORG, format: 'png_charts',
    });
    expect(res.format).toBe('png_charts');
    expect(res.manifest).toBeDefined();
    expect(res.anonymized).toBe(true);
  });
});