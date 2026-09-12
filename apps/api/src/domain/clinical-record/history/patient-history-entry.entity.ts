// apps/api/src/domain/clinical-record/history/patient-history-entry.entity.ts
// Domain entity: PatientHistoryEntry — structured clinical history with provenance.
// Spec §2: independently queryable values with author and source metadata.

import type { ReviewState } from '@medicore/contracts';

export type HistoryEntryType =
  | 'PERSONAL'
  | 'ALLERGY'
  | 'SURGICAL'
  | 'TOXIC_HABIT'
  | 'PROFESSION'
  | 'FAMILY'
  | 'ECOG';

export interface PatientHistoryEntryProps {
  id: string;
  organizationId: string;
  patientId: string;
  entryType: HistoryEntryType;
  key: string;
  value: string;
  sourceType: string;
  sourceId?: string | null;
  authorId: string;
  recordedAt: Date;
  reviewState: ReviewState;
  createdAt?: Date;
  updatedAt?: Date;
}

export class PatientHistoryEntry {
  readonly id: string;
  readonly organizationId: string;
  readonly patientId: string;
  readonly entryType: HistoryEntryType;
  readonly key: string;
  readonly value: string;
  readonly sourceType: string;
  readonly sourceId: string | null;
  readonly authorId: string;
  readonly recordedAt: Date;
  readonly reviewState: ReviewState;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: PatientHistoryEntryProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.patientId = props.patientId;
    this.entryType = props.entryType;
    this.key = props.key;
    this.value = props.value;
    this.sourceType = props.sourceType;
    this.sourceId = props.sourceId ?? null;
    this.authorId = props.authorId;
    this.recordedAt = props.recordedAt;
    this.reviewState = props.reviewState;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  /**
   * Unknown history items remain null/unknown — never inferred from medication or free text (spec §2).
   */
  get isUnknown(): boolean {
    return this.value.trim() === '' || this.value.toLowerCase() === 'unknown';
  }
}
