// apps/api/src/application/import/services/import-reminder.service.ts
// Spec §5 — periodic import reminder. The banner is computed on-demand per
// org from the latest ImportBatch.createdAt; the daily CRON (ImportReminderJob)
// reuses the same logic to identify orgs that have lapsed. Configurable per org
// via organization.settings.importReminderDays (default 15); setting it to 0
// disables the reminder entirely.
//
//   showBanner = daysSinceLastImport >= reminderDays   (never-imported → Infinity)

import { Injectable, Inject } from '@nestjs/common';
import type { IImportBatchRepository } from '@/domain/import/import-batch.repository.interface';
import type { IOrganizationRepository } from '@/domain/organization/organization.repository.interface';

export const DEFAULT_IMPORT_REMINDER_DAYS = 15;

export interface ReminderStatus {
  organizationId: string;
  /** Days since the last completed/pending import. null when the org never imported. */
  daysSinceLastImport: number | null;
  reminderDays: number;
  /** Whether the dashboard banner should be shown. */
  showBanner: boolean;
  /** Reminder disabled by org setting (reminderDays === 0). */
  disabled: boolean;
  /** ISO date of the last import, or null. */
  lastImportAt: string | null;
}

@Injectable()
export class ImportReminderService {
  constructor(
    @Inject('IImportBatchRepository') private readonly batchRepo: IImportBatchRepository,
    @Inject('IOrganizationRepository') private readonly orgRepo: IOrganizationRepository,
  ) {}

  /** Evaluate the banner state for a single org. */
  async evaluate(organizationId: string, now: Date = new Date()): Promise<ReminderStatus> {
    const org = await this.orgRepo.findById(organizationId);
    const reminderDays = this.readReminderDays(org?.settings);
    const disabled = reminderDays === 0;

    const latest = await this.batchRepo.findLatestByOrg(organizationId);
    const daysSinceLastImport = latest
      ? this.daysBetween(now, latest.createdAt)
      : null;

    const showBanner = !disabled && (daysSinceLastImport === null || daysSinceLastImport >= reminderDays);

    return {
      organizationId,
      daysSinceLastImport,
      reminderDays,
      showBanner,
      disabled,
      lastImportAt: latest ? latest.createdAt.toISOString() : null,
    };
  }

  /** Used by the daily CRON to enumerate every org needing a reminder. */
  async findOrgsNeedingReminder(now: Date = new Date()): Promise<ReminderStatus[]> {
    const orgs = await this.orgRepo.findAll();
    const due: ReminderStatus[] = [];
    for (const org of orgs) {
      const status = await this.evaluate(org.id, now);
      if (status.showBanner) due.push(status);
    }
    return due;
  }

  // ─────────────────────────────────────────────

  /** Read importReminderDays from org settings; falls back to default 15. */
  private readReminderDays(settings: Record<string, unknown> | undefined): number {
    const raw = (settings as Record<string, unknown> | undefined)?.importReminderDays;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
    return DEFAULT_IMPORT_REMINDER_DAYS;
  }

  private daysBetween(a: Date, b: Date): number {
    const MS = 86400000;
    const aDay = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
    const bDay = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
    return Math.floor((aDay - bDay) / MS);
  }
}
