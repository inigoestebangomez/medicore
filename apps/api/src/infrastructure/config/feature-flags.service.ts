// apps/api/src/infrastructure/config/feature-flags.service.ts
// Environment-variable based feature flag service for gradual rollout of
// new capabilities. Flags default to ENABLED (opt-out) for development.
//
// Research Engine V2 flags (design AD-7):
//   RESEARCH_V2_FIELD_DISCOVERY  — field autocomplete + catalog
//   RESEARCH_V2_STATS_SERVICE    — Python inferential stats
//   RESEARCH_V2_EXPORT_PDF       — journal-quality PDF export
//   RESEARCH_V2_SHARING          — intra-org query sharing
//   RESEARCH_V2_DASHBOARDS       — multi-widget dashboards

import { Injectable } from '@nestjs/common';

export type ResearchV2Flag =
  | 'RESEARCH_V2_FIELD_DISCOVERY'
  | 'RESEARCH_V2_STATS_SERVICE'
  | 'RESEARCH_V2_EXPORT_PDF'
  | 'RESEARCH_V2_SHARING'
  | 'RESEARCH_V2_DASHBOARDS';

const ALL_FLAGS: ResearchV2Flag[] = [
  'RESEARCH_V2_FIELD_DISCOVERY',
  'RESEARCH_V2_STATS_SERVICE',
  'RESEARCH_V2_EXPORT_PDF',
  'RESEARCH_V2_SHARING',
  'RESEARCH_V2_DASHBOARDS',
];

@Injectable()
export class FeatureFlagsService {
  /** Check whether a specific feature flag is enabled. */
  isEnabled(flag: ResearchV2Flag): boolean {
    const value = process.env[flag];
    // Absent → enabled (opt-out: flags default ON).
    if (value === undefined || value === '') return true;
    return value === 'true' || value === '1';
  }

  /** Resolve a single flag — throws if disabled (for use in guards). */
  require(flag: ResearchV2Flag): void {
    if (!this.isEnabled(flag)) {
      throw new FeatureDisabledError(flag);
    }
  }

  /** All Research V2 flags for seeding / health checks. */
  getAllFlags(): ResearchV2Flag[] {
    return ALL_FLAGS;
  }
}

export class FeatureDisabledError extends Error {
  constructor(public readonly flag: string) {
    super(`Feature flag "${flag}" is disabled`);
    this.name = 'FeatureDisabledError';
  }
}
