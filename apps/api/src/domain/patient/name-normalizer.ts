// apps/api/src/domain/patient/name-normalizer.ts
// Pure name normalization shared by the import pipeline and manual patient
// creation. No NestJS, no I/O, no side effects — trivially testable.
//
// Rules (per SDD spec import-data-quality):
//   - Title-case every word (first letter uppercase, rest lowercase).
//   - Spanish particles (De, Del, La, Los, Las, …) are kept first-letter
//     capital — which falls out of plain title-casing. Multi-word particle
//     sequences ("De La", "De Los", "De Las") mark the start of a compound
//     surname when splitting.
//   - Hyphenated words are title-cased per hyphen segment (García-López).
//   - Whitespace is trimmed and collapsed.

/** Particles that, when preceded by "De", open a compound surname. */
const COMPOUND_SURNAME_TAIL = new Set(['La', 'Los', 'Las']);

/**
 * Title-case a single token, handling hyphenated segments.
 *   "JUAN"        → "Juan"
 *   "GARCÍA-LÓPEZ" → "García-López"
 *   "ana"        → "Ana"
 */
function titleCaseWord(word: string): string {
  if (!word) return word;
  return word
    .split('-')
    .map((segment) => {
      if (!segment) return segment;
      return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
    })
    .join('-');
}

/**
 * Normalize a raw name to title case with capitalized particles.
 *   "JUAN CARLOS DE LA VEGA"  → "Juan Carlos De La Vega"
 *   "  JUAN   CARLOS  "       → "Juan Carlos"
 *   null / ""                 → ""
 */
export function normalizeName(raw: string): string {
  if (raw == null) return '';
  const trimmed = String(raw).trim();
  if (trimmed === '') return '';
  const collapsed = trimmed.replace(/\s+/g, ' ');
  return collapsed
    .split(' ')
    .map(titleCaseWord)
    .join(' ');
}

/**
 * Split a normalized name into first and last name.
 *
 * Rule: a compound surname opens at the first "De La" / "De Los" / "De Las"
 * sequence — everything from there on is the lastName. Otherwise the last
 * token is the lastName and the rest is the firstName. A single token is all
 * firstName with an empty lastName.
 *
 *   "Juan Carlos De La Vega"  → { firstName: "Juan Carlos", lastName: "De La Vega" }
 *   "Maria Del Carmen"        → { firstName: "Maria Del",   lastName: "Carmen" }
 *   "Pepe De Los Santos"      → { firstName: "Pepe",        lastName: "De Los Santos" }
 *   "José Antonio García-López" → { firstName: "José Antonio", lastName: "García-López" }
 *   "Ana"                     → { firstName: "Ana", lastName: "" }
 *   ""                        → { firstName: "",  lastName: "" }
 */
export function splitNormalizedName(normalized: string): { firstName: string; lastName: string } {
  const empty = { firstName: '', lastName: '' };
  if (!normalized) return empty;
  const tokens = normalized.split(' ');
  if (tokens.length === 1) {
    return { firstName: tokens[0], lastName: '' };
  }

  // Look for a "De <La|Los|Las>" compound-surname opening with at least one
  // preceding token reserved for the firstName.
  for (let i = 1; i < tokens.length - 1; i += 1) {
    if (tokens[i] === 'De' && COMPOUND_SURNAME_TAIL.has(tokens[i + 1])) {
      return {
        firstName: tokens.slice(0, i).join(' '),
        lastName: tokens.slice(i).join(' '),
      };
    }
  }

  // No compound-surname opening → last token is the lastName.
  return {
    firstName: tokens.slice(0, -1).join(' '),
    lastName: tokens[tokens.length - 1],
  };
}