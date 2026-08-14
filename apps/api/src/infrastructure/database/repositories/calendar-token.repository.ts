// apps/api/src/infrastructure/database/repositories/calendar-token.repository.ts
// Prisma ICalendarTokenRepository with AES-256-GCM encryption at rest for
// access + refresh tokens. Encryption key is read from
// CALENDAR_TOKEN_ENCRYPTION_KEY (32-byte base64). In dev a derived fallback
// key is used so the feature works without configuration; production MUST set
// the env var.

import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { PrismaService } from '../prisma.service';
import type {
  ICalendarTokenRepository,
  CalendarTokenRecord,
  SaveCalendarTokenInput,
} from '@/domain/calendar/calendar-token.repository.interface';
import type { CalendarProvider } from '@medicore/contracts';
import type { Prisma, CalendarToken as PrismaCalendarToken } from '@prisma/client';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12; // GCM recommends 96-bit IV
const TAG_LEN = 16;

function getKey(): Buffer {
  const raw = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;
  if (raw) {
    // Accept either a raw 32-byte string or a base64-encoded 32-byte key.
    try {
      const decoded = Buffer.from(raw, 'base64');
      if (decoded.length === 32) return decoded;
    } catch {
      /* fall through */
    }
    if (Buffer.byteLength(raw) === 32) return Buffer.from(raw, 'utf8');
  }
  // Dev fallback — deterministic derivation from a constant + JWT secret salt.
  // Never acceptable in production; the logger warns on first use.
  return scryptSync('medicore-calendar-token-key', process.env.JWT_SECRET ?? 'dev-secret-change-me', 32);
}

@Injectable()
export class PrismaCalendarTokenRepository implements ICalendarTokenRepository {
  private readonly logger = new Logger(PrismaCalendarTokenRepository.name);
  private readonly key = getKey();
  private warned = false;

  constructor(private readonly prisma: PrismaService) {
    if (!process.env.CALENDAR_TOKEN_ENCRYPTION_KEY && !this.warned) {
      this.warned = true;
      this.logger.warn(
        'CALENDAR_TOKEN_ENCRYPTION_KEY not set — using derived dev fallback key. Set a 32-byte base64 key in production.',
      );
    }
  }

  async saveToken(input: SaveCalendarTokenInput): Promise<CalendarTokenRecord> {
    const data: Prisma.CalendarTokenUncheckedCreateInput | Prisma.CalendarTokenUncheckedUpdateInput = {
      organizationId: input.organizationId,
      userId: input.userId,
      provider: input.provider,
      accessToken: this.encrypt(input.accessToken),
      refreshToken: input.refreshToken ? this.encrypt(input.refreshToken) : null,
      expiresAt: input.expiresAt,
      scope: input.scope ?? null,
      syncToken: input.syncToken ?? null,
      caldavUrl: input.caldavUrl ?? null,
    };

    // Upsert keyed on (userId, provider) unique constraint.
    const record = await this.prisma.calendarToken.upsert({
      where: { userId_provider: { userId: input.userId, provider: input.provider } },
      create: { ...data } as Prisma.CalendarTokenUncheckedCreateInput,
      update: { ...data } as Prisma.CalendarTokenUncheckedUpdateInput,
    });
    return this.toRecord(record);
  }

  async getToken(userId: string, provider: CalendarProvider): Promise<CalendarTokenRecord | null> {
    const record = await this.prisma.calendarToken.findUnique({
      where: { userId_provider: { userId, provider } },
    });
    if (!record) return null;
    return this.toRecord(record);
  }

  async deleteToken(userId: string, provider: CalendarProvider): Promise<boolean> {
    try {
      await this.prisma.calendarToken.delete({ where: { userId_provider: { userId, provider } } });
      return true;
    } catch {
      // P2025: record not found
      return false;
    }
  }

  async listByUser(userId: string): Promise<CalendarTokenRecord[]> {
    const records = await this.prisma.calendarToken.findMany({ where: { userId } });
    return records.map((r) => this.toRecord(r));
  }

  async listExpiringWithin(withinMs: number): Promise<CalendarTokenRecord[]> {
    const threshold = new Date(Date.now() + withinMs);
    const records = await this.prisma.calendarToken.findMany({ where: { expiresAt: { lte: threshold } } });
    return records.map((r) => this.toRecord(r));
  }

  async update(
    userId: string,
    provider: CalendarProvider,
    patch: Partial<Omit<SaveCalendarTokenInput, 'organizationId' | 'userId' | 'provider'>> & { lastSyncedAt?: Date },
  ): Promise<CalendarTokenRecord> {
    const data: Prisma.CalendarTokenUncheckedUpdateInput = {};
    if (patch.accessToken !== undefined) data.accessToken = this.encrypt(patch.accessToken);
    if (patch.refreshToken !== undefined) data.refreshToken = patch.refreshToken ? this.encrypt(patch.refreshToken) : null;
    if (patch.expiresAt !== undefined) data.expiresAt = patch.expiresAt;
    if (patch.scope !== undefined) data.scope = patch.scope ?? null;
    if (patch.syncToken !== undefined) data.syncToken = patch.syncToken ?? null;
    if (patch.caldavUrl !== undefined) data.caldavUrl = patch.caldavUrl ?? null;
    if (patch.lastSyncedAt !== undefined) data.lastSyncedAt = patch.lastSyncedAt;

    const record = await this.prisma.calendarToken.update({
      where: { userId_provider: { userId, provider } },
      data,
    });
    return this.toRecord(record);
  }

  // ── AES-256-GCM ─────────────────────────────────────────────
  // Ciphertext layout: iv(12) || tag(16) || ciphertext
  private encrypt(plain: string): string {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  private decrypt(blob: string): string {
    const buf = Buffer.from(blob, 'base64');
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const enc = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, this.key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
  }

  private toRecord(record: PrismaCalendarToken): CalendarTokenRecord {
    return {
      id: record.id,
      organizationId: record.organizationId,
      userId: record.userId,
      provider: record.provider as CalendarProvider,
      accessToken: this.decrypt(record.accessToken),
      refreshToken: record.refreshToken ? this.decrypt(record.refreshToken) : null,
      expiresAt: record.expiresAt,
      scope: record.scope,
      syncToken: record.syncToken,
      caldavUrl: record.caldavUrl,
      lastSyncedAt: record.lastSyncedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}