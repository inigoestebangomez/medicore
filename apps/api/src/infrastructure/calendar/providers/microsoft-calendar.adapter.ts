// apps/api/src/infrastructure/calendar/providers/microsoft-calendar.adapter.ts
// Microsoft Graph adapter — STUB. Full implementation will use
// @microsoft/microsoft-graph-client + MSAL. Raises "not yet implemented" so the
// surface is wired but provably inert until Phase 4.b.

import { Injectable, Inject } from '@nestjs/common';
import type { CalendarProvider } from '@medicore/contracts';
import type { ICalendarTokenRepository } from '@/domain/calendar/calendar-token.repository.interface';
import type {
  CalendarProviderAdapter,
  ExternalEvent,
  CreateExternalEventInput,
} from './calendar-provider.interface';

@Injectable()
export class MicrosoftCalendarAdapter implements CalendarProviderAdapter {
  readonly provider: CalendarProvider = 'MICROSOFT';

  constructor(@Inject('ICalendarTokenRepository') private readonly tokenRepo: ICalendarTokenRepository) {}

  getAuthorizationUrl(_userId: string): string {
    throw new Error('Microsoft Calendar sync is not yet implemented.');
  }

  async handleCallback(_code: string, _userId: string): Promise<void> {
    throw new Error('Microsoft Calendar sync is not yet implemented.');
  }

  async syncEvents(_userId: string, _from: Date, _to: Date): Promise<ExternalEvent[]> {
    throw new Error('Microsoft Calendar sync is not yet implemented.');
  }

  async createEvent(_userId: string, _event: CreateExternalEventInput): Promise<ExternalEvent> {
    throw new Error('Microsoft Calendar sync is not yet implemented.');
  }

  async isConnected(userId: string): Promise<boolean> {
    const token = await this.tokenRepo.getToken(userId, this.provider);
    return token !== null;
  }

  async disconnect(userId: string): Promise<void> {
    await this.tokenRepo.deleteToken(userId, this.provider);
  }
}