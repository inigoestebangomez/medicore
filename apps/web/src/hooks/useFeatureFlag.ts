// apps/web/src/hooks/useFeatureFlag.ts
// Client-side feature flag mirror of the backend FeatureFlagsService.
// Reads NEXT_PUBLIC_* env vars (inlined into the client bundle by Next.js).
// Defaults to ENABLED when the flag is absent — same opt-out convention as
// `feature-flags.service.ts:34-36` on the API.

export type ClientFeatureFlag = 'RESEARCH_V2_FIELD_DISCOVERY';

export function useFeatureFlag(flag: ClientFeatureFlag): boolean {
  const v = process.env[`NEXT_PUBLIC_${flag}`];
  return v === undefined || v === '' || v === 'true' || v === '1';
}