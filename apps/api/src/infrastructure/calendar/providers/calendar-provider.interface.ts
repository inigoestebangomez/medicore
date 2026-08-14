// apps/api/src/infrastructure/calendar/providers/calendar-provider.interface.ts
// Common contract every external calendar provider adapter implements.
// Adapters are responsible for provider-specific OAuth + event listing; token
// persistence/encryption is delegated to ICalendarTokenRepository (injected).

import type { CalendarProvider } from '@medicore/contracts';

/** Normalized event shape coming from an external calendar. */
export interface ExternalEvent {
  externalId: string; // provider-side event ID
  title: string;
  description: string | null;
  startDateTime: Date;
  endDateTime: Date;
  status: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
  metadata?: Record<string, unknown>;
}

export interface CreateExternalEventInput {
  title: string;
  description?: string | null;
  startDateTime: Date;
  endDateTime: Date;
}

export interface OAuthTokenSet {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: Date;
  scope?: string | null;
}

export interface CalendarProviderAdapter {
  readonly provider: CalendarProvider;
  /** Build the OAuth authorization URL the user must visit to grant access. */
  getAuthorizationUrl(userId: string): string;
  /** Exchange the OAuth `code` returned by the provider and persist the token. */
  handleCallback(code: string, userId: string): Promise<void>;
  /** Pull external events in [from, to]. Handles token refresh on 401. */
  syncEvents(userId: string, from: Date, to: Date): Promise<ExternalEvent[]>;
  /** Push a local event to the external calendar (best-effort). */
  createEvent(userId: string, event: CreateExternalEventInput): Promise<ExternalEvent>;
  /** Whether a valid token exists for this user+provider. */
  isConnected(userId: string): Promise<boolean>;
  /** Revoke provider access and remove stored tokens. */
  disconnect?(userId: string): Promise<void>;
}