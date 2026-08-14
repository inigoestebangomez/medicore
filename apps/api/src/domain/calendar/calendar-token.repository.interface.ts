// apps/api/src/domain/calendar/calendar-token.repository.interface.ts
import type { CalendarProvider } from '@medicore/contracts';

/**
 * Decrypted OAuth token record for a (user, provider) pair.
 * Encryption/decryption is the repository's concern — callers always see
 * plaintext access/refresh tokens here.
 */
export interface CalendarTokenRecord {
  id: string;
  organizationId: string;
  userId: string;
  provider: CalendarProvider;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scope: string | null;
  syncToken: string | null; // incremental sync cursor (Google/Microsoft)
  caldavUrl: string | null; // iCloud principal URL
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaveCalendarTokenInput {
  organizationId: string;
  userId: string;
  provider: CalendarProvider;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: Date;
  scope?: string | null;
  syncToken?: string | null;
  caldavUrl?: string | null;
}

export interface ICalendarTokenRepository {
  /** Upsert by (userId, provider) — unique constraint in Prisma. */
  saveToken(input: SaveCalendarTokenInput): Promise<CalendarTokenRecord>;
  getToken(userId: string, provider: CalendarProvider): Promise<CalendarTokenRecord | null>;
  deleteToken(userId: string, provider: CalendarProvider): Promise<boolean>;
  /** All tokens for a user across providers. */
  listByUser(userId: string): Promise<CalendarTokenRecord[]>;
  /** Tokens whose access token has expired (or will within `withinMs`), candidate for refresh. */
  listExpiringWithin(withinMs: number): Promise<CalendarTokenRecord[]>;
  /** Patch fields (e.g. refreshed access token, syncToken, lastSyncedAt). */
  update(userId: string, provider: CalendarProvider, patch: Partial<Omit<SaveCalendarTokenInput, 'organizationId' | 'userId' | 'provider'>> & { lastSyncedAt?: Date }): Promise<CalendarTokenRecord>;
}