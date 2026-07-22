// apps/api/src/application/import/services/phone-extractor.service.ts
// Aggressive phone extraction from arbitrary cell contents (SDD import-data-quality).
// Scans every string cell of a row, looks for Spanish phone patterns, and prefers
// a number explicitly labelled with a patient role tag over an unlabelled one.
//
// Role-tag logic:
//   1. If a phone is directly followed by (PACIENT)/(PACIENTE) → that's the
//      patient phone; return it (even if other non-patient tags exist).
//   2. If a non-patient role tag [(DONA)(HOME)(FAMILIAR)...] is present and no
//      patient tag matches → the phones belong to a relative/contact; suppress.
//   3. No role tag at all → return the first phone found.
//
// NOTE: The spec-suggested leading `\b` before the optional `+34` prefix was
// dropped: `\b` cannot match at the start of "+34 612..." because `+` is a
// non-word char, which would silently strip the `+` from the captured phone.
// The trailing `\b` is kept so the regex does not over-match into longer runs.

import { Injectable } from '@nestjs/common';

// Optional +34 prefix, then a Spanish mobile/landline starting with 6-9.
const SPANISH_PHONE = /(?:\+?34\s*)?[6-9]\d{2}\s*\d{3}\s*\d{3}\b/g;
// A phone immediately followed by a patient role tag.
const PATIENT_PHONE = /((?:\+?34\s*)?[6-9]\d{2}\s*\d{3}\s*\d{3})\b\s*\(PACIENTE?\)/i;
// A patient role tag anywhere in the cell.
const PATIENT_TAG = /\(PACIENTE?\)/i;
// A non-patient role tag anywhere in the cell (relative/contact/etc.).
const NON_PATIENT_TAG =
  /\((?:DONA|HOME|FAMILIAR|CONTACTO|MADRE|PADRE|HIJO|HIJA|ESPOSA|ESPOSO|TUTOR|RESPONSABLE|ACOMPAÑANTE|ACOMPANYANTE)\b/i;

@Injectable()
export class PhoneExtractorService {
  /**
   * Extract the patient phone from a raw import row, or null when no patient
   * phone can be determined.
   */
  extract(row: Record<string, unknown>): string | null {
    const cells = Object.values(row).filter((v): v is string => typeof v === 'string');
    if (cells.length === 0) return null;

    // 1) Prefer the phone attached to a (PACIENT)/(PACIENTE) role tag.
    for (const cell of cells) {
      const m = cell.match(PATIENT_PHONE);
      if (m) return this.normalize(m[1]);
    }

    // 2) A non-patient role tag (and no patient tag matched) → family/contact
    //    row: the phones belong to someone other than the patient.
    const hasNonPatientTag = cells.some(
      (c) => NON_PATIENT_TAG.test(c) && !PATIENT_TAG.test(c),
    );
    if (hasNonPatientTag) return null;

    // 3) No role tag at all → first phone wins.
    for (const cell of cells) {
      SPANISH_PHONE.lastIndex = 0;
      const m = SPANISH_PHONE.exec(cell);
      if (m) return this.normalize(m[0]);
    }

    return null;
  }

  /** Strip all whitespace from a captured phone string. */
  private normalize(raw: string): string {
    return raw.replace(/\s+/g, '');
  }
}