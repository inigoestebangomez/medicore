// apps/api/src/infrastructure/queues/import-reminder.job.ts
// Spec §5 daily CRON — runs at 09:00 every day, enumerates orgs that have
// lapsed past their importReminderDays threshold, and surfaces them. Today
// the reminder is an on-demand dashboard banner (no email — spec §5), so
// the job's role is to log/audit which orgs are due; the banner itself is
// computed live by ImportReminderService.evaluate(). When notification
// infra lands, this is where a push would be dispatched.

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ImportReminderService } from '@/application/import/services/import-reminder.service';

@Injectable()
export class ImportReminderJob {
  private readonly logger = new Logger(ImportReminderJob.name);

  constructor(private readonly reminder: ImportReminderService) {}

  /** Every day at 09:00 (spec §5). */
  @Cron('0 9 * * *')
  async runDaily(): Promise<void> {
    const due = await this.reminder.findOrgsNeedingReminder();
    if (due.length === 0) {
      this.logger.log('Daily import-reminder sweep: no orgs due.');
      return;
    }
    const lines = due.map(
      (s) => `org=${s.organizationId} daysSinceLastImport=${s.daysSinceLastImport ?? 'never'} reminderDays=${s.reminderDays}`,
    );
    this.logger.log(`Daily import-reminder sweep: ${due.length} org(s) due.\n${lines.join('\n')}`);
  }
}
