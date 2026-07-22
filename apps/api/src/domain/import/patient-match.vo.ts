// apps/api/src/domain/import/patient-match.vo.ts
// Value object describing a single row's best match against existing patients.

import type { MatchDecision } from '@medicore/contracts';

export interface PatientMatchProps {
  rowIndex: number;
  candidateId: string | null;       // existing patient id, or null if new
  score: number;                    // 0..100
  reason: string;                    // human-readable reason for the score
}

export class PatientMatchVO {
  static readonly AUTO_THRESHOLD = 90;   // >= 90 → auto-match (BR-IMP-004)
  static readonly SUGGEST_THRESHOLD = 50; // 50..89 → physician decides

  readonly rowIndex: number;
  readonly candidateId: string | null;
  readonly score: number;
  readonly reason: string;

  constructor(props: PatientMatchProps) {
    this.rowIndex = props.rowIndex;
    this.candidateId = props.candidateId;
    // Clamp score to valid range defensively.
    this.score = Math.max(0, Math.min(100, props.score));
    this.reason = props.reason;
  }

  /** Resolved decision based on score (BR-IMP-004). */
  get decision(): MatchDecision {
    if (this.score >= PatientMatchVO.AUTO_THRESHOLD) return 'auto';
    if (this.score >= PatientMatchVO.SUGGEST_THRESHOLD) return 'confirm';
    return 'new';
  }

  get isAutoMatch(): boolean {
    return this.decision === 'auto';
  }

  get requiresPhysicianConfirmation(): boolean {
    return this.decision === 'confirm';
  }

  get createsNewPatient(): boolean {
    return this.decision === 'new';
  }
}