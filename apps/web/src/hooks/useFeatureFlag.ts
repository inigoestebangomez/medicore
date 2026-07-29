// apps/web/src/hooks/useFeatureFlag.ts
// Client-side feature flag hook mirroring the backend FeatureFlagsService.
// Reads NEXT_PUBLIC_* env vars (inlined into the client bundle by Next.js).
// Defaults to ENABLED when the flag is absent — same opt-out convention as
// `feature-flags.service.ts` on the API.

import { isFlagEnabled, type ClientFlag } from '@/config/client-feature-flags';

// Backwards-compatible type alias for existing V2 callers.
export type ClientFeatureFlag = 'RESEARCH_V2_FIELD_DISCOVERY';

export function useFeatureFlag(flag: ClientFlag | ClientFeatureFlag): boolean {
  return isFlagEnabled(flag as ClientFlag);
}