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
//
// Research Engine V3 flags — all default ON (opt-out), independent toggles:
//   RESEARCH_V3_STUDIES   — ResearchStudy lifecycle + live cohorts + notifications (M8)
//   RESEARCH_V3_TABLE1    — Table 1 auto stat selection + group comparison (M2/M6)
//   RESEARCH_V3_PRE_POST  — Pre/post paired analysis (M3)
//   RESEARCH_V3_VIZ       — Histogram / Pie / Bland-Altman / Forest / survival table (M4/M5)
//   RESEARCH_V3_EXPORT    — Multi-format export v3: docx, TIFF, R/SPSS, ZIP (M7)

import { Injectable } from '@nestjs/common';

export type ResearchV2Flag =
  | 'RESEARCH_V2_FIELD_DISCOVERY'
  | 'RESEARCH_V2_STATS_SERVICE'
  | 'RESEARCH_V2_EXPORT_PDF'
  | 'RESEARCH_V2_SHARING'
  | 'RESEARCH_V2_DASHBOARDS';

export type ResearchV3Flag =
  | 'RESEARCH_V3_STUDIES'
  | 'RESEARCH_V3_TABLE1'
  | 'RESEARCH_V3_PRE_POST'
  | 'RESEARCH_V3_VIZ'
  | 'RESEARCH_V3_EXPORT';

// Research Engine V4 flags — all default ON (opt-out), independent toggles:
//   RESEARCH_FORM_BUILDER     — Form-builder core: variables/subjects/analyses (REQ-FB-013)
//   RESEARCH_VARIABLE_LIBRARY — Org-level reusable variable templates (REQ-FB-002)
//   RESEARCH_AGREEMENT_TESTS  — Kappa/ICC/Cronbach endpoints (REQ-FB-010)
export type ResearchV4Flag =
  | 'RESEARCH_FORM_BUILDER'
  | 'RESEARCH_VARIABLE_LIBRARY'
  | 'RESEARCH_AGREEMENT_TESTS';

export type ResearchFlag = ResearchV2Flag | ResearchV3Flag | ResearchV4Flag;

const ALL_FLAGS: ResearchFlag[] = [
  'RESEARCH_V2_FIELD_DISCOVERY',
  'RESEARCH_V2_STATS_SERVICE',
  'RESEARCH_V2_EXPORT_PDF',
  'RESEARCH_V2_SHARING',
  'RESEARCH_V2_DASHBOARDS',
  'RESEARCH_V3_STUDIES',
  'RESEARCH_V3_TABLE1',
  'RESEARCH_V3_PRE_POST',
  'RESEARCH_V3_VIZ',
  'RESEARCH_V3_EXPORT',
  'RESEARCH_FORM_BUILDER',
  'RESEARCH_VARIABLE_LIBRARY',
  'RESEARCH_AGREEMENT_TESTS',
];

@Injectable()
export class FeatureFlagsService {
  /** Check whether a specific feature flag is enabled. */
  isEnabled(flag: ResearchFlag): boolean {
    const value = process.env[flag];
    // Absent → enabled (opt-out: flags default ON).
    if (value === undefined || value === '') return true;
    return value === 'true' || value === '1';
  }

  /** Resolve a single flag — throws if disabled (for use in guards). */
  require(flag: ResearchFlag): void {
    if (!this.isEnabled(flag)) {
      throw new FeatureDisabledError(flag);
    }
  }

  /** All Research flags for seeding / health checks. */
  getAllFlags(): ResearchFlag[] {
    return ALL_FLAGS;
  }
}

export class FeatureDisabledError extends Error {
  constructor(public readonly flag: string) {
    super(`Feature flag "${flag}" is disabled`);
    this.name = 'FeatureDisabledError';
  }
}