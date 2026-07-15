// apps/api/src/application/import/services/import-reminder.service.spec.ts
import { describe, it, expect } from '@jest/globals';
import { ImportReminderService } from './import-reminder.service';
import type { ImportBatch } from '@/domain/import/import-batch.entity';

function makeBatch(createdAt: Date): ImportBatch {
  return new (require('@/domain/import/import-batch.entity').ImportBatch)({
    id: 'b', organizationId: 'org-1', createdBy: 'u', fileName: 'f.xlsx',
    fileSize: 1, fileHash: 'h', originalFormat: 'xlsx',
    sample: { columns: [], rows: [] }, columnMapping: {}, status: 'COMPLETED',
    createdAt,
  });
}

function buildService(opts: {
  orgSettings?: Record<string, unknown> | null;
  latest?: ImportBatch | null;
  orgs?: any[];
}) {
  const batchRepo: any = {
    findLatestByOrg: async () => opts.latest ?? null,
  };
  const orgRepo: any = {
    findById: async () => ({ id: 'org-1', settings: opts.orgSettings ?? {} }),
    findAll: async () => opts.orgs ?? [],
  };
  return new ImportReminderService(batchRepo, orgRepo);
}

describe('ImportReminderService (spec §5 banner logic)', () => {
  it('shows banner when daysSinceLastImport >= reminderDays (default 15)', async () => {
    const now = new Date('2026-07-15T09:00:00Z');
    const twenty = new Date('2026-06-25T09:00:00Z'); // 20 days ago
    const svc = buildService({ latest: makeBatch(twenty) });
    const s = await svc.evaluate('org-1', now);
    expect(s.reminderDays).toBe(15);
    expect(s.daysSinceLastImport).toBe(20);
    expect(s.showBanner).toBe(true);
  });

  it('does not show banner when recently imported (within threshold)', async () => {
    const now = new Date('2026-07-15T09:00:00Z');
    const two = new Date('2026-07-13T09:00:00Z'); // 2 days ago
    const svc = buildService({ latest: makeBatch(two) });
    const s = await svc.evaluate('org-1', now);
    expect(s.daysSinceLastImport).toBe(2);
    expect(s.showBanner).toBe(false);
  });

  it('shows banner when the org never imported (Infinity)', async () => {
    const svc = buildService({ latest: null });
    const s = await svc.evaluate('org-1', new Date());
    expect(s.daysSinceLastImport).toBeNull();
    expect(s.showBanner).toBe(true);
  });

  it('respects a custom org setting for reminderDays', async () => {
    const now = new Date('2026-07-15T09:00:00Z');
    const ten = new Date('2026-07-05T09:00:00Z'); // 10 days ago
    const svc = buildService({ orgSettings: { importReminderDays: 7 }, latest: makeBatch(ten) });
    const s = await svc.evaluate('org-1', now);
    expect(s.reminderDays).toBe(7);
    expect(s.showBanner).toBe(true);
  });

  it('reminderDays=0 disables the reminder (no banner even if never imported)', async () => {
    const svc = buildService({ orgSettings: { importReminderDays: 0 }, latest: null });
    const s = await svc.evaluate('org-1', new Date());
    expect(s.disabled).toBe(true);
    expect(s.showBanner).toBe(false);
  });

  it('findOrgsNeedingReminder enumerates orgs with showBanner=true', async () => {
    // Two orgs: one lapsed (30 days), one recent (1 day).
    const now = new Date('2026-07-15T09:00:00Z');
    const svc = buildService({
      orgs: [{ id: 'org-a' }, { id: 'org-b' }],
    });
    // Override evaluate to deterministically simulate per-org state.
    const orig = svc.evaluate.bind(svc);
    let n = 0;
    (svc as any).evaluate = async () => {
      const s = await orig(n === 0 ? 'org-a' : 'org-b', now);
      n++;
      return { ...s, showBanner: n === 1 };
    };
    const due = await svc.findOrgsNeedingReminder(now);
    expect(due.length).toBe(1);
    expect(due[0].organizationId).toBe('org-a');
  });
});
