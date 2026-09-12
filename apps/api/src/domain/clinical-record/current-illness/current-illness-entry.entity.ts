// apps/api/src/domain/clinical-record/current-illness/current-illness-entry.entity.ts
// Domain entity: CurrentIllnessEntry — structured illness evolution linked to source consultation.
// Spec §3: symptoms, duration, onset, evolution, narrative.

import type { ReviewState } from '@medicore/contracts';

export type DurationUnit = 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';

export interface CurrentIllnessEntryProps {
  id: string;
  organizationId: string;
  patientId: string;
  symptoms: string;
  durationValue?: number | null;
  durationUnit?: DurationUnit | null;
  onset?: Date | null;
  evolution?: string | null;
  narrative?: string | null;
  consultationId?: string | null;
  sourceType: string;
  authorId: string;
  recordedAt: Date;
  reviewState: ReviewState;
  createdAt?: Date;
  updatedAt?: Date;
}

export class CurrentIllnessEntry {
  readonly id: string;
  readonly organizationId: string;
  readonly patientId: string;
  readonly symptoms: string;
  readonly durationValue: number | null;
  readonly durationUnit: DurationUnit | null;
  readonly onset: Date | null;
  readonly evolution: string | null;
  readonly narrative: string | null;
  readonly consultationId: string | null;
  readonly sourceType: string;
  readonly authorId: string;
  readonly recordedAt: Date;
  readonly reviewState: ReviewState;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: CurrentIllnessEntryProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.patientId = props.patientId;
    this.symptoms = props.symptoms;
    this.durationValue = props.durationValue ?? null;
    this.durationUnit = props.durationUnit ?? null;
    this.onset = props.onset ?? null;
    this.evolution = props.evolution ?? null;
    this.narrative = props.narrative ?? null;
    this.consultationId = props.consultationId ?? null;
    this.sourceType = props.sourceType;
    this.authorId = props.authorId;
    this.recordedAt = props.recordedAt;
    this.reviewState = props.reviewState;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  /**
   * Partial entry: missing temporal fields remain null (spec §3 — partial entry scenario).
   */
  get hasTemporalData(): boolean {
    return this.durationValue !== null || this.onset !== null;
  }

  /**
   * Formatted duration string for display.
   */
  get formattedDuration(): string | null {
    if (this.durationValue === null || this.durationUnit === null) return null;
    const unitLabel = this.durationUnit.toLowerCase();
    return `${this.durationValue} ${unitLabel}`;
  }
}
