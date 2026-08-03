// apps/api/src/application/research/study-handlers.spec.ts
import { describe, it, expect, jest } from '@jest/globals';
import { CreateStudyHandler, type CreateStudyCommand } from './commands/create-study.handler';
import { FreezeStudyHandler } from './commands/freeze-study.handler';
import { ArchiveStudyHandler } from './commands/archive-study.handler';
import { ReactivateStudyHandler } from './commands/reactivate-study.handler';
import { RecalculateStudyHandler } from './commands/recalculate-study.handler';
import { GetStudyHandler } from './queries/get-study.handler';
import { ListStudiesHandler } from './queries/list-studies.handler';
import { ListNotificationsHandler } from './queries/list-notifications.handler';
import { StudyLifecycleService } from './services/study-lifecycle.service';
import { ResearchStudy } from '@/domain/research/research-study.entity';
import { StudyNotFoundError, StudyOwnershipError } from '@/domain/research/errors/study-not-found.error';
import type { IResearchStudyRepository, Paginated } from '@/domain/research/ports/research-study.repository.interface';
import type { IStudyNotificationRepository } from '@/domain/research/ports/study-notification.repository.interface';
import type { IResearchQueryRepository } from '@/domain/research/research-query.repository.interface';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockRepo<T>(overrides: any = {}): T {
  return overrides as T;
}

const studyProps = {
  id: 'study-1',
  organizationId: 'org-1',
  createdBy: 'user-1',
  queryId: 'q-1',
  name: 'Cohort',
  status: 'ACTIVE' as const,
  cachedPatientIds: ['p1', 'p2'],
  cachedAt: new Date(),
  patientCount: 2,
};

const activeStudy = new ResearchStudy(studyProps);

describe('CreateStudyHandler', () => {
  it('creates a DRAFT study when the query exists', async () => {
    const studyRepo = mockRepo<IResearchStudyRepository>({
      create: jest.fn(async (s) => s),
    });
    const queryRepo = mockRepo<IResearchQueryRepository>({
      findById: jest.fn(async () => ({ id: 'q-1', filters: [], filterLogic: 'AND', dataSource: 'all_patients', displayFields: [], importBatchIds: [] } as any)),
    });
    const h = new CreateStudyHandler(studyRepo, queryRepo);
    const cmd: CreateStudyCommand = {
      organizationId: 'org-1',
      createdBy: 'user-1',
      input: { studyType: 'QUERY', queryId: 'q-1', name: 'New Cohort' },
    };
    const s = await h.execute(cmd);
    expect(s.status.value).toBe('DRAFT');
    expect(s.name).toBe('New Cohort');
    expect(studyRepo.create).toHaveBeenCalledTimes(1);
  });

  it('throws when the origin query does not exist', async () => {
    const queryRepo = mockRepo<IResearchQueryRepository>({ findById: jest.fn(async () => null) });
    const studyRepo = mockRepo<IResearchStudyRepository>({ create: jest.fn() });
    const h = new CreateStudyHandler(studyRepo, queryRepo);
    await expect(h.execute({ organizationId: 'o', createdBy: 'u', input: { studyType: 'QUERY', queryId: 'nope', name: 'x' } }))
      .rejects.toThrow();
  });
});

describe('FreezeStudyHandler (BR-RES-009)', () => {
  it('freezes active study owned by the caller', async () => {
    const studyRepo = mockRepo<IResearchStudyRepository>({
      findById: jest.fn(async () => activeStudy),
      update: jest.fn(async (s) => s),
    });
    const h = new FreezeStudyHandler(studyRepo);
    const frozen = await h.execute({ studyId: 'study-1', organizationId: 'org-1', userId: 'user-1' });
    expect(frozen.status.value).toBe('FROZEN');
    expect(studyRepo.update).toHaveBeenCalledTimes(1);
  });

  it('rejects freeze by non-owner', async () => {
    const studyRepo = mockRepo<IResearchStudyRepository>({
      findById: jest.fn(async () => activeStudy),
      update: jest.fn(),
    });
    const h = new FreezeStudyHandler(studyRepo);
    await expect(h.execute({ studyId: 'study-1', organizationId: 'org-1', userId: 'intruder' }))
      .rejects.toThrow(StudyOwnershipError);
  });

  it('throws when study not found', async () => {
    const studyRepo = mockRepo<IResearchStudyRepository>({ findById: jest.fn(async () => null) });
    const h = new FreezeStudyHandler(studyRepo);
    await expect(h.execute({ studyId: 'x', organizationId: 'o', userId: 'u' })).rejects.toThrow(StudyNotFoundError);
  });
});

describe('ArchiveStudyHandler & ReactivateStudyHandler', () => {
  it('archives then reactivates', async () => {
    const studyRepo = mockRepo<IResearchStudyRepository>({
      findById: jest.fn(async () => activeStudy),
      update: jest.fn(async (s) => s),
    });
    const archive = new ArchiveStudyHandler(studyRepo);
    const archived = await archive.execute({ studyId: 'study-1', organizationId: 'org-1' });
    expect(archived.status.value).toBe('ARCHIVED');

    const reactivate = new ReactivateStudyHandler(studyRepo);
    const reactivated = await reactivate.execute({ studyId: 'study-1', organizationId: 'org-1' });
    expect(reactivated.status.value).toBe('ACTIVE');
  });
});

describe('RecalculateStudyHandler', () => {
  it('updates cached patient ids from re-executed query', async () => {
    const studyRepo = mockRepo<IResearchStudyRepository>({
      findById: jest.fn(async () => activeStudy),
      update: jest.fn(async (s) => s),
    });
    const exec = { execute: jest.fn(async () => ({ rows: [{ patientId: 'p1' }, { patientId: 'p2' }, { patientId: 'p3' }] })) };
    const h = new RecalculateStudyHandler(studyRepo, exec as any);
    const s = await h.execute({ studyId: 'study-1', organizationId: 'org-1' });
    expect(s.cachedPatientIds).toEqual(['p1', 'p2', 'p3']);
    expect(s.patientCount).toBe(3);
  });

  it('blocks recalculation on a frozen study', async () => {
    const frozen = new ResearchStudy({ ...studyProps, status: 'FROZEN', frozenAt: new Date() });
    const studyRepo = mockRepo<IResearchStudyRepository>({ findById: jest.fn(async () => frozen) });
    const exec = { execute: jest.fn() };
    const h = new RecalculateStudyHandler(studyRepo, exec as any);
    await expect(h.execute({ studyId: 'frozen', organizationId: 'org-1' })).rejects.toThrow(/frozen/i);
  });
});

describe('GetStudyHandler & ListStudiesHandler', () => {
  it('returns study or throws not found', async () => {
    const studyRepo = mockRepo<IResearchStudyRepository>({ findById: jest.fn(async () => activeStudy) });
    const get = new GetStudyHandler(studyRepo);
    expect((await get.execute({ studyId: 'study-1', organizationId: 'org-1' })).id).toBe('study-1');

    const notFoundRepo = mockRepo<IResearchStudyRepository>({ findById: jest.fn(async () => null) });
    await expect(new GetStudyHandler(notFoundRepo).execute({ studyId: 'x', organizationId: 'o' })).rejects.toThrow(StudyNotFoundError);
  });

  it('lists studies paginated', async () => {
    const expected: Paginated<ResearchStudy> = { items: [activeStudy], total: 1, page: 1, pageSize: 20 };
    const studyRepo = mockRepo<IResearchStudyRepository>({ findByOrganization: jest.fn(async () => expected) });
    const list = new ListStudiesHandler(studyRepo);
    const res = await list.execute({ organizationId: 'org-1' });
    expect(res.total).toBe(1);
  });
});

describe('ListNotificationsHandler', () => {
  it('returns notifications and unread count', async () => {
    const notifications = [{ id: 'n1', studyId: 's1', userId: 'u1', newPatientCount: 3, readAt: null, createdAt: new Date() }];
    const notifRepo = mockRepo<IStudyNotificationRepository>({
      findByStudy: jest.fn(async () => notifications as any),
      countUnread: jest.fn(async () => 1),
      markAllAsReadForStudy: jest.fn(async () => 1),
    });
    const h = new ListNotificationsHandler(notifRepo);
    const res = await h.execute({ studyId: 's1', organizationId: 'o', userId: 'u1' });
    expect(res.notifications).toHaveLength(1);
    expect(res.unreadCount).toBe(1);
    expect(await h.markAllRead('s1', 'u1')).toBe(1);
  });
});

describe('StudyLifecycleService (BR-RES-008)', () => {
  it('recalculates stale active studies and creates notifications for new patients', async () => {
    const stale = new ResearchStudy({
      ...studyProps,
      cachedAt: new Date(Date.now() - 10 * 3600 * 1000), // stale > 6h
      cachedPatientIds: ['p1'],
      patientCount: 1,
    });
    const studyRepo = mockRepo<IResearchStudyRepository>({
      findActiveWithStaleCache: jest.fn(async () => [stale]),
      update: jest.fn(async (s) => s),
    });
    const created: any[] = [];
    const notifRepo = mockRepo<IStudyNotificationRepository>({
      create: jest.fn(async (n) => { created.push(n); return n; }),
    });
    const exec = {
      execute: jest.fn(async () => ({ rows: [{ patientId: 'p1' }, { patientId: 'p2' }] })),
    };
    const svc = new StudyLifecycleService(studyRepo, notifRepo, exec as any);
    const results = await svc.recalculateStaleStudies('org-1', 'batch-1');
    expect(results).toHaveLength(1);
    expect(results[0].newPatientCount).toBe(1);
    expect(results[0].notificationCreated).toBe(true);
    expect(created).toHaveLength(1);
    expect(created[0].newPatientCount).toBe(1);
  });

  it('does NOT create a notification when cohort did not grow', async () => {
    const stale = new ResearchStudy({
      ...studyProps,
      cachedAt: new Date(Date.now() - 10 * 3600 * 1000),
      cachedPatientIds: ['p1', 'p2'],
      patientCount: 2,
    });
    const studyRepo = mockRepo<IResearchStudyRepository>({
      findActiveWithStaleCache: jest.fn(async () => [stale]),
      update: jest.fn(async (s) => s),
    });
    let created = 0;
    const notifRepo = mockRepo<IStudyNotificationRepository>({
      create: jest.fn(async (n) => { created++; return n; }),
    });
    const exec = { execute: jest.fn(async () => ({ rows: [{ patientId: 'p1' }, { patientId: 'p2' }] })) };
    const svc = new StudyLifecycleService(studyRepo, notifRepo, exec as any);
    const results = await svc.recalculateStaleStudies('org-1', 'batch-2');
    expect(results[0].newPatientCount).toBe(0);
    expect(results[0].notificationCreated).toBe(false);
    expect(created).toBe(0);
  });
});