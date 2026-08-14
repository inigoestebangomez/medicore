import { createHash } from 'node:crypto';
import type { ImportedEventsPage } from '@medicore/contracts';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import { ImportedClinicalEventProjector } from '../services/imported-clinical-event-projector';

export class InvalidImportedEventsCursorError extends Error {
  constructor() { super('Invalid imported events cursor'); }
}

export interface ListImportedClinicalEventsInput {
  patientId: string;
  organizationId: string;
  pageSize?: number;
  cursor?: string;
}

interface CursorPayload { version: 1; snapshot: string; after: string }

function snapshotHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value) ?? 'null').digest('hex');
}

function encodeCursor(value: CursorPayload): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeCursor(value: string): CursorPayload {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as CursorPayload;
    if (parsed.version !== 1 || typeof parsed.snapshot !== 'string' || typeof parsed.after !== 'string') throw new Error();
    return parsed;
  } catch {
    throw new InvalidImportedEventsCursorError();
  }
}

export class ListImportedClinicalEventsUseCase {
  constructor(
    private readonly repository: IPatientRepository,
    private readonly projector: ImportedClinicalEventProjector,
  ) {}

  async execute(input: ListImportedClinicalEventsInput): Promise<ImportedEventsPage> {
    const pageSize = input.pageSize ?? 50;
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new Error('pageSize must be between 1 and 100');
    }
    const snapshot = this.repository.findImportedDataById
      ? await this.repository.findImportedDataById(input.patientId, input.organizationId)
      : null;
    if (!snapshot) throw new Error('Patient not found');
    const projected = this.projector.project(snapshot.importedData, snapshot.importSource);
    const snapshotKey = `${snapshot.updatedAt.toISOString()}:${snapshotHash(snapshot.importedData)}`;
    let start = 0;
    if (input.cursor) {
      const cursor = decodeCursor(input.cursor);
      if (cursor.snapshot !== snapshotKey) throw new InvalidImportedEventsCursorError();
      const index = projected.items.findIndex((item) => item.id === cursor.after);
      if (index < 0) throw new InvalidImportedEventsCursorError();
      start = index + 1;
    }
    const pageItems = projected.items.slice(start, start + pageSize);
    const hasMore = start + pageSize < projected.items.length;
    const last = pageItems[pageItems.length - 1];
    const nextCursor = hasMore && last
      ? encodeCursor({ version: 1, snapshot: snapshotKey, after: last.id })
      : null;
    return {
      version: 'v1',
      items: ImportedClinicalEventProjector.stripSortFields({ ...projected, items: pageItems }),
      nextCursor,
      hasMore,
      truncated: projected.truncated,
    };
  }
}
