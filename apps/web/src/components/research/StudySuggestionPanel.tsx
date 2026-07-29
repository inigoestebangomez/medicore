'use client';

// apps/web/src/components/research/StudySuggestionPanel.tsx
// Dismissible auto-suggestion cards (M8). Each card shows the suggestion type,
// rationale, recommended endpoint, and preview params.

import { useState } from 'react';
import type { StudySuggestionDTO } from '@/hooks/useStudiesWithBadges';

const TYPE_LABEL: Record<string, string> = {
  pre_post_available: 'Análisis pre/post',
  group_comparison_recommended: 'Comparación de grupos',
  sufficient_followup: 'Seguimiento suficiente',
  regression_feasible: 'Regresión factible',
  table_one_recommended: 'Tabla 1 recomendada',
};

export interface StudySuggestionPanelProps {
  suggestions?: StudySuggestionDTO[];
}

export function StudySuggestionPanel({ suggestions }: StudySuggestionPanelProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = (suggestions ?? []).filter((s) => !dismissed.has(s.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((s) => (
        <div
          key={s.id}
          className="flex items-start justify-between gap-2 rounded-md border border-secondary/30 bg-secondary/5 p-3 text-sm"
        >
          <div className="min-w-0">
            <div className="font-semibold text-on-surface">{TYPE_LABEL[s.type] ?? s.type}</div>
            <div className="mt-0.5 text-xs text-on-surface-variant">{s.rationale}</div>
            {s.recommendedEndpoint && (
              <code className="mt-1 block break-all rounded bg-surface-low px-1 text-[11px] text-on-surface-variant">
                {s.recommendedEndpoint}
              </code>
            )}
          </div>
          <button
            type="button"
            aria-label="Descartar sugerencia"
            onClick={() => setDismissed((prev) => new Set(prev).add(s.id))}
            className="rounded px-1 text-on-surface-variant hover:bg-surface-low"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export default StudySuggestionPanel;