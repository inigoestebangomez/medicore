'use client';

// apps/web/src/features/research-form/components/AnalysisRunner/RiskFactorBadge.tsx
// RiskFactorBadge (REQ-FB-011): label an association as risk/protective/neutral
// from the OR/HR effect estimate. Rendered on the analysis history.

import type { RiskFactorLabel } from '@medicore/contracts';

const STYLE: Record<RiskFactorLabel, string> = {
  RISK_FACTOR: 'bg-error/15 text-error',
  PROTECTIVE_FACTOR: 'bg-success/15 text-success',
  NEUTRAL: 'bg-surface-low text-on-surface-variant',
};

const LABEL: Record<RiskFactorLabel, string> = {
  RISK_FACTOR: 'Factor de riesgo',
  PROTECTIVE_FACTOR: 'Factor protector',
  NEUTRAL: 'Neutral',
};

export function RiskFactorBadge({ label }: { label: RiskFactorLabel | null }) {
  const cls = label ? STYLE[label] : 'bg-surface-low text-on-surface-variant';
  const text = label ? LABEL[label] : '—';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{text}</span>
  );
}

export default RiskFactorBadge;