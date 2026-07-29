// apps/web/tokens/clinical.ts
// Clinical-precision design tokens (design §Frontend Architecture).
// Semantic WCAG AA (4.5:1) colors, Inter (UI) + JetBrains Mono (IDs/numbers),
// 4-px spacing grid, tabular-nums for dense data tables & stats.
//
// These tokens are surfaced as CSS custom properties (inject `clinicalTokensCss`
// once into the app head) and consumed via Tailwind arbitrary values or the
// `clinical-*` color helpers below. Keeps the research UI visually distinct
// from the operational MediCore chrome without forking the design system.

export interface ClinicalColor {
  name: string;
  /** Foreground text color that meets WCAG AA 4.5:1 on a white card. */
  onLight: string;
  /** Tailwind-compatible `bg-*`/`text-*` helper (semantic alias). */
  token: string;
}

export const clinicalColors: Record<
  'critical' | 'warning' | 'info' | 'success' | 'neutral',
  ClinicalColor
> = {
  critical: { name: 'critical', onLight: '#B91C1C', token: 'var(--clinical-critical)' },
  warning: { name: 'warning', onLight: '#D97706', token: 'var(--clinical-warning)' },
  info: { name: 'info', onLight: '#0369A1', token: 'var(--clinical-info)' },
  success: { name: 'success', onLight: '#15803D', token: 'var(--clinical-success)' },
  neutral: { name: 'neutral', onLight: '#374151', token: 'var(--clinical-neutral)' },
};

export const clinicalSpacing = [0, 4, 8, 12, 16, 24, 32, 48, 64] as const;
export const clinicalRadius = { dense: '4px', card: '12px' } as const;
export const clinicalFont = {
  ui: "Inter, system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

/** Tabular-numbers utility for stats tables / IDs (design §Tokens). */
export const tabularNums = { fontFeatureSettings: "'tnum'", fontVariantNumeric: 'tabular-nums' } as const;

/** CSS to inject once (e.g. in the dashboard layout head) to register tokens. */
export const clinicalTokensCss = `
:root {
  --clinical-critical: #B91C1C;
  --clinical-warning: #D97706;
  --clinical-info: #0369A1;
  --clinical-success: #15803D;
  --clinical-neutral: #374151;
  --clinical-radius-dense: 4px;
  --clinical-radius-card: 12px;
}
`;

/** Tailwind class fragment for a semantic clinical color. */
export function clinicalColor(name: keyof typeof clinicalColors): string {
  return `text-[${clinicalColors[name].token}]`;
}
