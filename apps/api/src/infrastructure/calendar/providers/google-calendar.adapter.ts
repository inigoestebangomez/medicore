// apps/api/src/infrastructure/calendar/providers/google-calendar.adapter.ts
// Google Calendar adapter built on the `googleapis` npm package. Uses OAuth2
// credentials from GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (the same values the
// web Auth.js config uses). Tokens are stored encrypted via
// ICalendarTokenRepository; access/expiry is refreshed transparently inside
// syncEvents on 401.

import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { google, Auth } from 'googleapis';
import type { CalendarProvider } from '@medicore/contracts';
import type { ICalendarTokenRepository } from '@/domain/calendar/calendar-token.repository.interface';
import type {
  CalendarProviderAdapter,
  ExternalEvent,
  CreateExternalEventInput,
} from './calendar-provider.interface';

// Calendar scopes — readonly for sync; calendar.events gives push access.
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

function redirectBase(): string {
  return (
    process.env.CALENDAR_OAUTH_REDIRECT_BASE ??
    process.env.API_URL ??
    'http://localhost:3001'
  );
}

@Injectable()
export class GoogleCalendarAdapter implements CalendarProviderAdapter {
  readonly provider: CalendarProvider = 'GOOGLE';
  private readonly logger = new Logger(GoogleCalendarAdapter.name);

  constructor(@Inject('ICalendarTokenRepository') private readonly tokenRepo: ICalendarTokenRepository) {}

  private buildOAuthClient(redirectUriOverride?: string): Auth.OAuth2Client {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error(
        'Google Calendar sync requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars.',
      );
    }
    const redirectUri =
      redirectUriOverride ?? `${redirectBase()}/v1/calendar/sync/callback/GOOGLE`;
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  getAuthorizationUrl(userId: string): string {
    const client = this.buildOAuthClient();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // force refresh_token on every connect
      scope: SCOPES,
      state: userId,
    });
  }

  async handleCallback(code: string, userId: string): Promise<void> {
    const client = this.buildOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.access_token) {
      throw new Error('Google OAuth callback returned no access token.');
    }
    // Resolve org + existing token row to preserve organizationId on update.
    const existing = await this.tokenRepo.getToken(userId, this.provider);
    if (!existing) {
      // We need organizationId to persist; without it we cannot store the token.
      // The caller (controller) passes userId that already has a token row created
      // during connect. If missing, reject.
      throw new NotFoundException(
        `No pending calendar token row for user ${userId} — call connect first.`,
      );
    }
    await this.tokenRepo.saveToken({
      organizationId: existing.organizationId,
      userId,
      provider: this.provider,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? existing.refreshToken,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600_000),
      scope: tokens.scope ?? null,
      syncToken: existing.syncToken,
    });
  }

  async isConnected(userId: string): Promise<boolean> {
    const token = await this.tokenRepo.getToken(userId, this.provider);
    return token !== null;
  }

  async disconnect(userId: string): Promise<void> {
    const token = await this.tokenRepo.getToken(userId, this.provider);
    if (token) {
      // Revoke the token with Google
      try {
        const client = this.buildOAuthClient();
        client.setCredentials({ access_token: token.accessToken });
        await client.revokeCredentials();
      } catch (err) {
        this.logger.warn(`Failed to revoke Google token for user ${userId}: ${err}`);
      }
      await this.tokenRepo.deleteToken(userId, this.provider);
    }
  }

  async syncEvents(userId: string, from: Date, to: Date): Promise<ExternalEvent[]> {
    const token = await this.refreshIfNeeded(userId);
    const client = this.buildOAuthClient();
    client.setCredentials({
      access_token: token.accessToken,
      refresh_token: token.refreshToken ?? undefined,
    });
    const calendar = google.calendar({ version: 'v3', auth: client });

    try {
      const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });
      const items = res.data.items ?? [];
      return items.map((item) => this.toExternal(item));
    } catch (err) {
      this.logger.error(`Google sync failed for user ${userId}: ${(err as Error).message}`);
      // If 401, clear token so user can reconnect from UI.
      if ((err as { code?: number }).code === 401) {
        await this.tokenRepo.deleteToken(userId, this.provider).catch(() => undefined);
      }
      throw err;
    }
  }

  async createEvent(userId: string, event: CreateExternalEventInput): Promise<ExternalEvent> {
    const token = await this.refreshIfNeeded(userId);
    const client = this.buildOAuthClient();
    client.setCredentials({
      access_token: token.accessToken,
      refresh_token: token.refreshToken ?? undefined,
    });
    const calendar = google.calendar({ version: 'v3', auth: client });
    const created = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: event.title,
        description: event.description ?? undefined,
        start: { dateTime: event.startDateTime.toISOString() },
        end: { dateTime: event.endDateTime.toISOString() },
      },
    });
    return this.toExternal(created.data);
  }

  // ── helpers ─────────────────────────────────────────────
  private async refreshIfNeeded(userId: string) {
    const token = await this.tokenRepo.getToken(userId, this.provider);
    if (!token) {
      throw new NotFoundException(`Google Calendar not connected for user ${userId}.`);
    }
    // Refresh when token expires within the next 60s or is already expired.
    if (token.expiresAt.getTime() - Date.now() > 60_000) {
      return token;
    }
    if (!token.refreshToken) {
      throw new Error(`No refresh token available for user ${userId}; reconnect required.`);
    }
    const client = this.buildOAuthClient();
    client.setCredentials({ refresh_token: token.refreshToken });
    const { credentials } = await client.refreshAccessToken();
    if (!credentials.access_token) {
      throw new Error('Google token refresh returned no access token.');
    }
    const updated = await this.tokenRepo.update(userId, this.provider, {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token ?? token.refreshToken,
      expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 3600_000),
    });
    return updated;
  }

  private toExternal(item: any): ExternalEvent {
    const start = item.start?.dateTime ?? item.start?.date;
    const end = item.end?.dateTime ?? item.end?.date;
    const status = item.status === 'cancelled' ? 'CANCELLED' : item.status === 'tentative' ? 'TENTATIVE' : 'CONFIRMED';
    return {
      externalId: item.id,
      title: item.summary ?? '(Sin título)',
      description: item.description ?? null,
      startDateTime: new Date(start as string),
      endDateTime: new Date(end as string),
      status,
      metadata: { htmlLink: item.htmlLink ?? null, location: item.location ?? null },
    };
  }
}