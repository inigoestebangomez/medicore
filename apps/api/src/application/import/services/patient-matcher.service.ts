// apps/api/src/application/import/services/patient-matcher.service.ts
// Stage 4 patient matching per spec §4. Pure scoring logic over candidates
// fetched from IPatientRepository; produces one PatientMatchVO per cleaned row.
//
// Scoring (spec §4):
//   NHC exacto                    100  → auto-match (BR-IMP-004, ≥90)
//   Nombre completo + nacimiento   90  → auto-match
//   Nombre completo exacto         60  → physician decides (50..89)
//   Nombre completo + edad          50  → physician decides
//   Nombre parcial (apellidos)      30  → new patient (<50)
//   partial name + nacimiento       50  → physician decides (birthdate adds confidence)
//
// NHC exact match compares the imported NHC string against the stored patient
// NHC. Hospital NHCs (e.g. 13046043) rarely equal MediCore NHCs (2026-00012),
// so most matches fall through to name+birthdate — which is the spec intent:
// NHC=100 is reserved for the unambiguous case.

import { Injectable, Inject } from '@nestjs/common';
import { PatientMatchVO } from '@/domain/import/patient-match.vo';
import type { Patient } from '@/domain/patient/patient.entity';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import type { CleanedRow } from './data-cleaner.service';

export interface MatchInput {
  organizationId: string;
  rows: CleanedRow[];
}

export interface MatchResult {
  matches: PatientMatchVO[];
}

export type NameMatchKind = 'full' | 'partial' | 'none';

// Age tolerance: an imported age can drift ±1 year across import dates
// (spec §4 "edad aproximada").
const AGE_TOLERANCE_YEARS = 1;

@Injectable()
export class PatientMatcherService {
  constructor(@Inject('IPatientRepository') private readonly patientRepo: IPatientRepository) {}

  async match(input: MatchInput): Promise<MatchResult> {
    const matches: PatientMatchVO[] = [];

    for (const row of input.rows) {
      const match = await this.matchRow(row, input.organizationId);
      matches.push(match);
    }

    return { matches };
  }

  private async matchRow(row: CleanedRow, organizationId: string): Promise<PatientMatchVO> {
    const candidates = await this.findCandidates(row, organizationId);

    let best: PatientMatchVO | null = null;

    for (const candidate of candidates) {
      const scored = this.score(row, candidate);
      if (!best || scored.score > best.score) {
        best = scored;
        // NHC exact = 100 → can't beat it; short-circuit.
        if (best.score >= 100) break;
      }
    }

    if (best && best.candidateId !== null) {
      return best;
    }

    // No candidate reached the suggest floor → new patient.
    return new PatientMatchVO({
      rowIndex: row.rowIndex,
      candidateId: null,
      score: 0,
      reason: 'no matching candidate found',
    });
  }

  /**
   * Fetch candidate patients for a row. Strategy:
   *  - NHC present → exact NHC lookup (most reliable, returns 0..1).
   *  - patientName present → fuzzy name search using the last token as lastName.
   * Combines both result sets when both signals exist.
   */
  private async findCandidates(row: CleanedRow, organizationId: string): Promise<Patient[]> {
    const byNhcPromise = row.nhc
      ? this.patientRepo.findByNhc(row.nhc, organizationId)
      : Promise.resolve(null);

    const nameTokens = row.patientName ? row.patientName.trim().split(/\s+/) : [];
    const lastName = nameTokens.length > 0 ? nameTokens[nameTokens.length - 1] : undefined;
    const firstName = nameTokens.length > 1 ? nameTokens[0] : undefined;

    const byNamePromise =
      row.patientName && lastName
        ? this.patientRepo.searchByNameFuzzy(organizationId, lastName, firstName)
        : Promise.resolve<Patient[]>([]);

    const [byNhc, byName] = await Promise.all([byNhcPromise, byNamePromise]);

    const merged: Patient[] = [];
    const seen = new Set<string>();
    if (byNhc && !seen.has(byNhc.id)) {
      merged.push(byNhc);
      seen.add(byNhc.id);
    }
    for (const p of byName) {
      if (!seen.has(p.id)) {
        merged.push(p);
        seen.add(p.id);
      }
    }
    return merged;
  }

  /**
   * Score a cleaned row against a candidate patient. Pure function — same
   * inputs always yield the same score and reason.
   */
  score(row: CleanedRow, candidate: Patient): PatientMatchVO {
    // 1. NHC exacto → 100 (auto). Spec §4: identificador inequívoco.
    if (row.nhc && this.normalizeId(row.nhc) === this.normalizeId(candidate.nhc)) {
      return new PatientMatchVO({
        rowIndex: row.rowIndex,
        candidateId: candidate.id,
        score: 100,
        reason: 'NHC exacto',
      });
    }

    const nameMatch = this.computeNameMatch(row.patientName, candidate);
    const birthMatch = this.birthDatesMatch(row.birthDate, candidate.birthDate, row.birthDateEstimated);
    const ageReference = row.birthDateReferenceYear
      ? new Date(Date.UTC(row.birthDateReferenceYear, 0, 1))
      : undefined;
    const ageMatch = this.agesMatch(row.age, candidate, ageReference);

    // 2. Nombre completo + fecha de nacimiento → 90 (auto).
    if (nameMatch === 'full' && birthMatch) {
      return new PatientMatchVO({
        rowIndex: row.rowIndex,
        candidateId: candidate.id,
        score: 90,
        reason: 'nombre completo + fecha de nacimiento',
      });
    }

    // 3. Nombre completo exacto → 60 (confirm).
    if (nameMatch === 'full') {
      return new PatientMatchVO({
        rowIndex: row.rowIndex,
        candidateId: candidate.id,
        score: 60,
        reason: 'nombre completo exacto',
      });
    }

    // 4. Nombre completo + edad aproximada → 50 (confirm).
    //    Detected when full name failed but age matches AND a partial name
    //    overlap exists (covers "IVAN" vs "Iván Rumí" with age 50).
    if (nameMatch === 'partial' && ageMatch) {
      return new PatientMatchVO({
        rowIndex: row.rowIndex,
        candidateId: candidate.id,
        score: 50,
        reason: 'nombre parcial + edad aproximada',
      });
    }

    // 5. Nombre parcial + fecha de nacimiento → 50 (confirm).
    if (nameMatch === 'partial' && birthMatch) {
      return new PatientMatchVO({
        rowIndex: row.rowIndex,
        candidateId: candidate.id,
        score: 50,
        reason: 'nombre parcial + fecha de nacimiento',
      });
    }

    // 6. Nombre parcial (apellidos) → 30 (new patient).
    if (nameMatch === 'partial') {
      return new PatientMatchVO({
        rowIndex: row.rowIndex,
        candidateId: candidate.id,
        score: 30,
        reason: 'nombre parcial (apellidos)',
      });
    }

    // No usable signal → new patient.
    return new PatientMatchVO({
      rowIndex: row.rowIndex,
      candidateId: null,
      score: 0,
      reason: 'no matching signal',
    });
  }

  // ─────────────────────────────────────────────
  // Name comparison
  // ─────────────────────────────────────────────

  computeNameMatch(rowName: string | null, candidate: Patient): NameMatchKind {
    if (!rowName) return 'none';

    const rn = this.normalizeMatchable(rowName);
    if (!rn) return 'none';

    // Candidate full name in both Spanish orders (firstName lastName, lastName firstName).
    const cf = this.normalizeMatchable(`${candidate.firstName ?? ''} ${candidate.lastName ?? ''}`);
    const cfReverse = this.normalizeMatchable(`${candidate.lastName ?? ''} ${candidate.firstName ?? ''}`);
    const cl = this.normalizeMatchable(candidate.lastName);

    if (rn === cf || rn === cfReverse) return 'full';

    // Partial: any candidate name token (firstName or lastName, ≥3 chars) appears
    // as a whole token inside the row name, OR a candidate multi-token name is
    // contained in the row name. Token-boundary checks avoid "mart" matching
    // "martinez". This lets "IVAN" partially match "Ivan Rumi" (firstName overlap)
    // so name+age scoring can apply.
    const rnTokens = new Set(rn.split(/\s+/));
    const cfNorm = this.normalizeMatchable(candidate.firstName);
    const candidateNameTokens = new Set<string>();
    for (const part of [cfNorm, cl]) {
      for (const tok of (part || '').split(/\s+/)) {
        if (tok.length >= 3) candidateNameTokens.add(tok);
      }
    }
    let shared = 0;
    for (const t of candidateNameTokens) if (rnTokens.has(t)) shared++;
    if (shared > 0) return 'partial';
    if (cl && cl.length >= 4 && rn.includes(cl)) return 'partial';
    if (cfNorm && cfNorm.length >= 4 && rn.includes(cfNorm)) return 'partial';

    return 'none';
  }

  // ─────────────────────────────────────────────
  // Field comparators
  // ─────────────────────────────────────────────

  birthDatesMatch(a: Date | null, b: Date | null, estimated = false): boolean {
    if (estimated) return false;
    if (!a || !b) return false;
    return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
  }

  agesMatch(rowAge: number | null, candidate: Patient, referenceDate?: Date): boolean {
    if (rowAge === null) return false;
    // SDD import-data-quality: a candidate with null birthDate has no age to
    // compare against — skip age scoring rather than penalize or falsely match
    // (null age would coerce to 0 and match any 0-age row).
    const candidateAge = candidate.age(referenceDate);
    if (candidateAge === null) return false;
    return Math.abs(rowAge - candidateAge) <= AGE_TOLERANCE_YEARS;
  }

  // ─────────────────────────────────────────────
  // Normalizers (NFD + diacritic strip, lowercased) — same approach as
  // DataCleanerService.normalizeMatchable to keep cross-stage consistency.
  // ─────────────────────────────────────────────

  private normalizeMatchable(value: unknown): string {
    if (value == null) return '';
    return String(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /** NHC comparison ignores leading zeros and whitespace (1.8685362E7 edge). */
  private normalizeId(nhc: string): string {
    const trimmed = nhc.trim();
    // Numeric (possibly scientific notation from Excel) → integer string.
    if (/^\d+(\.\d+)?(E\d+)?$/i.test(trimmed)) {
      return Math.round(parseFloat(trimmed.replace(/E/i, 'e'))).toString();
    }
    return this.normalizeMatchable(trimmed);
  }
}
