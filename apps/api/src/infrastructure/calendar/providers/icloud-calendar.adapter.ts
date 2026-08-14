// apps/api/src/infrastructure/calendar/providers/icloud-calendar.adapter.ts
// iCloud (Apple) CalDAV adapter — STUB. Full implementation will use `tsdav`
// to discover the principal URL from the user's Apple ID + app-specific
// password, then list events from the default calendar. Raises "not yet
// implemented" so the surface is wired but provably inert until Phase 4.c.

import { Injectable, Inject } from '@nestjs/common';
import type { CalendarProvider } from '@medicore/contracts';
import type { ICalendarTokenRepository } from '@/domain/calendar/calendar-token.repository.interface';
import type {
  CalendarProviderAdapter,
  ExternalEvent,
  CreateExternalEventInput,
} from './calendar-provider.interface';

@Injectable()
export class ICloudCalendarAdapter implements CalendarProviderAdapter {
  readonly provider: CalendarProvider = 'APPLE';

  constructor(@Inject('ICalendarTokenRepository') private readonly tokenRepo: ICalendarTokenRepository) {}

  getAuthorizationUrl(_userId: string): string {
    // iCloud uses app-specific passwords, not OAuth — the UI collects credentials
    // directly. Returning a stub here keeps the adapter homogeneous; the connect
    // flow will route iCloud through a different endpoint in the full impl.
    throw new Error('iCloud Calendar sync is not yet implemented.');
  }

  async handleCallback(_code: string, _userId: string): Promise<void> {
    throw new Error('iCloud Calendar sync is not yet implemented.');
  }

  async syncEvents(_userId: string, _from: Date, _to: Date): Promise<ExternalEvent[]> {
    throw new Error('iCloud Calendar sync is not yet implemented.');
  }

  async createEvent(_userId: string, _event: CreateExternalEventInput): Promise<ExternalEvent> {
    throw new Error('iCloud Calendar sync is not yet implemented.');
  }

  async isConnected(userId: string): Promise<boolean> {
    const token = await this.tokenRepo.getToken(userId, this.provider);
    return token !== null;
  }

  async disconnect(userId: string): Promise<void> {
    await this.tokenRepo.deleteToken(userId, this.provider);
  }
}