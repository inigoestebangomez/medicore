// apps/web/src/features/guided-analysis/components/DescriptiveStep.tsx
// Path 1 configuration: select variables for descriptive analysis.

'use client';

import { useState } from 'react';
import type { GuidedAnalysisRequest } from '@medicore/contracts';

interface DescriptiveStepProps {
  variables: string[];
  onRun: (request: Omit<GuidedAnalysisRequest, 'queryId'>) => void;
  onBack: () => void;
  isLoading: boolean;
}

export function DescriptiveStep({
  variables,
  onRun,
  onBack,
  isLoading,
}: DescriptiveStepProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggleVariable = (v: string) => {
    setSelected((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  };

  const handleRun = () => {
    if (selected.length === 0) return;
    onRun({ path: 'descriptive', variables: selected, alpha: 0.05 });
  };

  // Variables por defecto cuando no hay variables cargadas
  const defaultVariables = [
    'age',
    'sex',
    'bloodType',
    'hospitalStayDays',
    'surgeryDurationMinutes',
  ];

  const availableVariables = variables.length > 0 ? variables : defaultVariables;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Análisis descriptivo</h2>
        <p className="text-sm text-muted-foreground">
          Seleccione las variables que desea describir.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4">
        <div className="flex flex-wrap gap-2">
          {availableVariables.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => toggleVariable(v)}
              className={`rounded-full px-3 py-1 text-sm transition ${
                selected.includes(v)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        {selected.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Seleccione al menos una variable.
          </p>
        )}
        {variables.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Mostrando variables comunes. Para ver todas las variables disponibles, ejecute primero una consulta de investigación.
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary"
        >
          Atrás
        </button>
        <button
          type="button"
          onClick={handleRun}
          disabled={selected.length === 0 || isLoading}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading ? 'Analizando…' : 'Ejecutar análisis'}
        </button>
      </div>
    </div>
  );
}
