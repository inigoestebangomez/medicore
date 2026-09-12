// apps/web/src/config/client-feature-flags.ts
// Client-side feature flag mirror of the backend FeatureFlagsService.
// Reads NEXT_PUBLIC_* env vars (inlined by Next.js). Defaults to ENABLED when
// the flag is absent — same opt-out convention as the API.

export const CLIENT_FLAGS = [
  'RESEARCH_V2_FIELD_DISCOVERY',
  'RESEARCH_V3_STUDIES',
  'RESEARCH_V3_TABLE1',
  'RESEARCH_V3_PRE_POST',
  'RESEARCH_V3_VIZ',
  'RESEARCH_V3_EXPORT',
  // Research Engine V4 (REQ-FB-013)
  'RESEARCH_FORM_BUILDER',
  'RESEARCH_VARIABLE_LIBRARY',
  'RESEARCH_AGREEMENT_TESTS',
  // Seven clinical categories (sdd/patient-seven-categories)
  'CLINICAL_RECORD_V2',
] as const;

export type ClientFlag = (typeof CLIENT_FLAGS)[number];

export function isFlagEnabled(flag: ClientFlag): boolean {
  const v = process.env[`NEXT_PUBLIC_${flag}`];
  // Absent → enabled (opt-out: flags default ON).
  return v === undefined || v === '' || v === 'true' || v === '1';
}