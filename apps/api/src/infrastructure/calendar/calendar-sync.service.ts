// apps/api/src/infrastructure/calendar/calendar-sync.service.ts
// Orchestrates external calendar sync:
//   1. @Cron('*/15 * * * *') — every 15 minutes refresh tokens nearing expiry
//      and pull external events for every connected (user, provider).
//   2. refreshUser(userId, provider?) — on-demand pull triggered by the
//      POST /v1/calendar/sync/refresh endpoint.
// External events are upserted as CalendarEvent rows with source =
// EXTERNAL_GOOGLE / EXTERNAL_MICROSOFT / EXTERNAL_ICLOUD and status = TENTATIVE.

import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { CalendarProvider } from '@medicore/contracts';
import type { ICalendarTokenRepository } from '@/domain/calendar/calendar-token.repository.interface';
import type { ICalendarEventRepository } from '@/domain/calendar/calendar-event.repository.interface';
import { CalendarEvent, CalendarEventSource, CalendarEventStatus } from '@/domain/calendar/calendar-event.entity';
import type { CalendarProviderAdapter, ExternalEvent } from './providers/calendar-provider.interface';
import { GoogleCalendarAdapter } from './providers/google-calendar.adapter';
import { MicrosoftCalendarAdapter } from './providers/microsoft-calendar.adapter';
import { ICloudCalendarAdapter } from './providers/icloud-calendar.adapter';

const SYNC_WINDOW_DAYS = 90; // sync ±90 days around now

function providerToSource(provider: CalendarProvider): CalendarEventSource {
  switch (provider) {
    case 'GOOGLE':
      return CalendarEventSource.EXTERNAL_GOOGLE;
    case 'MICROSOFT':
      return CalendarEventSource.EXTERNAL_MICROSOFT;
    case 'APPLE':
      return CalendarEventSource.EXTERNAL_ICLOUD;
  }
}

function externalStatusToEventStatus(s: ExternalEvent['status']): CalendarEventStatus {
  if (s === 'CANCELLED') return CalendarEventStatus.CANCELLED;
  if (s === 'TENTATIVE') return CalendarEventStatus.TENTATIVE;
  return CalendarEventStatus.CONFIRMED;
}

@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);
  private readonly adapters: Map<CalendarProvider, CalendarProviderAdapter>;

  constructor(
    @Inject('ICalendarTokenRepository') private readonly tokenRepo: ICalendarTokenRepository,
    @Inject('ICalendarEventRepository') private readonly eventRepo: ICalendarEventRepository,
    google: GoogleCalendarAdapter,
    microsoft: MicrosoftCalendarAdapter,
    icloud: ICloudCalendarAdapter,
  ) {
    this.adapters = new Map<CalendarProvider, CalendarProviderAdapter>([
      ['GOOGLE', google],
      ['MICROSOFT', microsoft],
      ['APPLE', icloud],
    ]);
  }

  /** Every 15 minutes — refresh all connected users. */
  @Cron('*/15 * * * *')
  async refreshAll(): Promise<void> {
    const due = await this.tokenRepo.listExpiringWithin(5 * 60_000);
    if (due.length > 0) {
      this.logger.log(`Cron sweep: ${due.length} token(s) due for refresh/sync.`);
    }
    for (const token of due) {
      await this.refreshOne(token.userId, token.provider).catch((err) => {
        this.logger.error(
          `Sync failed for user=${token.userId} provider=${token.provider}: ${(err as Error).message}`,
        );
      });
    }
  }

  /** On-demand refresh for one provider (or all) for one user. */
  async refreshUser(userId: string, provider?: CalendarProvider): Promise<CalendarProvider[]> {
    const providers = provider ? [provider] : await this.connectedProviders(userId);
    const synced: CalendarProvider[] = [];
    for (const p of providers) {
      try {
        await this.refreshOne(userId, p);
        synced.push(p);
      } catch (err) {
        this.logger.error(`Manual sync failed for user=${userId} provider=${p}: ${(err as Error).message}`);
      }
    }
    return synced;
  }

  // ── internals ─────────────────────────────────────────────

  private async connectedProviders(userId: string): Promise<CalendarProvider[]> {
    const tokens = await this.tokenRepo.listByUser(userId);
    return tokens.map((t) => t.provider);
  }

  private async refreshOne(userId: string, provider: CalendarProvider): Promise<void> {
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new NotFoundException(`No adapter for provider ${provider}.`);
    if (!(await adapter.isConnected(userId))) return;

    const from = new Date(Date.now() - SYNC_WINDOW_DAYS * 24 * 3600_000);
    const to = new Date(Date.now() + SYNC_WINDOW_DAYS * 24 * 3600_000);

    // adapter.syncEvents handles token refresh on 401.
    const events = await adapter.syncEvents(userId, from, to);
    const token = await this.tokenRepo.getToken(userId, provider);
    if (!token) return; // disconnected mid-flight

    for (const e of events) {
      await this.upsertMirror(token.organizationId, userId, provider, e);
    }
    await this.tokenRepo.update(userId, provider, { lastSyncedAt: new Date() });
    this.logger.log(
      `Synced ${events.length} event(s) for user=${userId} provider=${provider}.`,
    );
  }

  private async upsertMirror(
    organizationId: string,
    userId: string,
    provider: CalendarProvider,
    ext: ExternalEvent,
  ): Promise<void> {
    // Find existing mirror by externalCalendarId within the user's events.
    const existing = await this.eventRepo.listByUserAndDateRange({
      userId,
      organizationId,
      from: new Date(ext.startDateTime.getTime() - 24 * 3600_000),
      to: new Date(ext.endDateTime.getTime() + 24 * 3600_000),
    });
    const match = existing.find((e) => e.externalCalendarId === ext.externalId);

    const source = providerToSource(provider);
    const status = externalStatusToEventStatus(ext.status);

    if (match) {
      await this.eventRepo.update(
        new CalendarEvent({
          id: match.id,
          organizationId: match.organizationId,
          userId: match.userId,
          source,
          sourceId: match.sourceId,
          externalCalendarId: ext.externalId,
          title: ext.title,
          description: ext.description,
          startDateTime: ext.startDateTime,
          endDateTime: ext.endDateTime,
          status,
          isPublic: false,
          contactName: null,
          contactEmail: null,
          metadata: ext.metadata ?? null,
          lastSyncedAt: new Date(),
          deletedAt: ext.status === 'CANCELLED' ? new Date() : null,
          createdAt: match.createdAt,
          updatedAt: new Date(),
        }),
      );
      return;
    }
    if (ext.status === 'CANCELLED') return; // don't create mirror for cancelled external event with no local row

    await this.eventRepo.create(
      CalendarEvent.create({
        organizationId,
        userId,
        source,
        sourceId: null,
        externalCalendarId: ext.externalId,
        title: ext.title,
        description: ext.description,
        startDateTime: ext.startDateTime,
        endDateTime: ext.endDateTime,
        status,
        isPublic: false,
        contactName: null,
        contactEmail: null,
        metadata: ext.metadata ?? null,
        lastSyncedAt: new Date(),
        deletedAt: null,
      }),
    );
  }
}