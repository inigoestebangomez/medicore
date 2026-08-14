// packages/contracts/src/calendar.schema.ts
// Calendar domain contracts — persisted CalendarEvent records, virtual
// CalendarEventView shape (multi-source), and CRUD/query schemas used by the
// /v1/calendar/events endpoints.

import { z } from 'zod';

// ─────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────

export const CalendarEventSourceSchema = z.enum([
  'SURGERY',
  'CONSULTATION',
  'PHARMA_INTERACTION',
  'MANUAL',
  'PUBLIC_BOOKING',
  'EXTERNAL_GOOGLE',
  'EXTERNAL_MICROSOFT',
  'EXTERNAL_ICLOUD',
]);
export type CalendarEventSource = z.infer<typeof CalendarEventSourceSchema>;

export const CalendarEventStatusSchema = z.enum([
  'RESERVED',
  'CONFIRMED',
  'CANCELLED',
  'TENTATIVE',
]);
export type CalendarEventStatus = z.infer<typeof CalendarEventStatusSchema>;

export const CalendarProviderSchema = z.enum([
  'GOOGLE',
  'MICROSOFT',
  'APPLE',
]);
export type CalendarProvider = z.infer<typeof CalendarProviderSchema>;

// ─────────────────────────────────────────────
// CalendarEventView — merged view returned by GET /v1/calendar/events
// Identical shape for persisted records and virtual ( Surgery | Consultation |
// PharmaInteraction ) records. Virtual records set `isReadOnly: true`.
// ─────────────────────────────────────────────

export const CalendarEventViewSchema = z.object({
  id: z.string(),
  source: CalendarEventSourceSchema,
  title: z.string(),
  description: z.string().nullable(),
  startDateTime: z.string(),
  endDateTime: z.string(),
  status: CalendarEventStatusSchema,
  isPublic: z.boolean().default(false),
  isReadOnly: z.boolean().default(false),
  sourceId: z.string().nullable().optional(),
  patientId: z.string().nullable().optional(),
  patientName: z.string().nullable().optional(),
  // Navigation link for clinical/pharma sources (route relative to web root).
  // Examples: `/patients/{patientId}/surgeries/{surgeryId}`, `/pharma/{contactId}`.
  link: z.string().nullable().optional(),
});
export type CalendarEventView = z.infer<typeof CalendarEventViewSchema>;

// ─────────────────────────────────────────────
// CRUD schemas
// ─────────────────────────────────────────────

export const CreateCalendarEventSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  startDateTime: z.string().datetime({ message: 'Invalid ISO datetime' }),
  endDateTime: z.string().datetime({ message: 'Invalid ISO datetime' }),
  isPublic: z.boolean().default(false),
});
export type CreateCalendarEventInput = z.infer<typeof CreateCalendarEventSchema>;

export const UpdateCalendarEventSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  startDateTime: z.string().datetime().optional(),
  endDateTime: z.string().datetime().optional(),
  status: CalendarEventStatusSchema.optional(),
  isPublic: z.boolean().optional(),
});
export type UpdateCalendarEventInput = z.infer<typeof UpdateCalendarEventSchema>;

// ─────────────────────────────────────────────
// List query
// ─────────────────────────────────────────────

export const ListCalendarEventsQuerySchema = z.object({
  from: z.string().datetime({ message: 'Invalid ISO datetime' }),
  to: z.string().datetime({ message: 'Invalid ISO datetime' }),
});
export type ListCalendarEventsQuery = z.infer<typeof ListCalendarEventsQuerySchema>;

// ─────────────────────────────────────────────
// Raw persisted CalendarEvent (used by future sync code)
// ─────────────────────────────────────────────

export const CalendarEventResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  startDateTime: z.string(),
  endDateTime: z.string(),
  source: CalendarEventSourceSchema,
  sourceId: z.string().nullable(),
  status: CalendarEventStatusSchema,
  isPublic: z.boolean(),
  externalCalendarId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CalendarEventResponse = z.infer<typeof CalendarEventResponseSchema>;

// ─────────────────────────────────────────────
// External Calendar Sync (Phase 4)
// Provider = GOOGLE | MICROSOFT | APPLE (iCloud). Reuses CalendarProviderSchema
// so the sync surface and the persisted CalendarToken.provider stay aligned.
// ─────────────────────────────────────────────

export const CalendarSyncProviderSchema = CalendarProviderSchema;
export type CalendarSyncProvider = CalendarProvider;

export const ProviderConnectionStatusSchema = z.object({
  provider: CalendarSyncProviderSchema,
  connected: z.boolean(),
  lastSyncedAt: z.string().nullable(),
});
export type ProviderConnectionStatus = z.infer<typeof ProviderConnectionStatusSchema>;

export const ListSyncProvidersResponseSchema = z.object({
  providers: z.array(ProviderConnectionStatusSchema),
});
export type ListSyncProvidersResponse = z.infer<typeof ListSyncProvidersResponseSchema>;

// GET authorization URL → user starts OAuth flow in browser
export const ConnectProviderResponseSchema = z.object({
  authorizationUrl: z.string().url(),
});
export type ConnectProviderResponse = z.infer<typeof ConnectProviderResponseSchema>;

// OAuth callback: provider redirects back with `code` (+ optional `state`)
export const CallbackProviderRequestSchema = z.object({
  code: z.string().min(1),
  state: z.string().optional(),
});
export type CallbackProviderRequest = z.infer<typeof CallbackProviderRequestSchema>;

export const CallbackProviderResponseSchema = z.object({
  connected: z.boolean(),
  provider: CalendarSyncProviderSchema,
});
export type CallbackProviderResponse = z.infer<typeof CallbackProviderResponseSchema>;

// POST /v1/calendar/sync/disconnect/:provider — no body
export const DisconnectProviderResponseSchema = z.object({
  disconnected: z.boolean(),
  provider: CalendarSyncProviderSchema,
});
export type DisconnectProviderResponse = z.infer<typeof DisconnectProviderResponseSchema>;

// POST /v1/calendar/sync/refresh — manual sync trigger
export const SyncRefreshResponseSchema = z.object({
  synced: z.array(CalendarSyncProviderSchema),
  message: z.string().optional(),
});
export type SyncRefreshResponse = z.infer<typeof SyncRefreshResponseSchema>;