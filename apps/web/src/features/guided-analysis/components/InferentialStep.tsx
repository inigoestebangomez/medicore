// apps/web/src/features/guided-analysis/components/InferentialStep.tsx
// Path 2 configuration: exposure domain, elements, outcome, correction.

'use client';

import { useState } from 'react';
import type { GuidedAnalysisRequest, CorrectionMethod } from '@medicore/contracts';

interface InferentialStepProps {
  variables: string[];
  onRun: (request: Omit<GuidedAnalysisRequest, 'queryId'>) => void;
  onBack: () => void;
  isLoading: boolean;
}

const EXPOSURE_DOMAINS = [
  { value: 'diagnosis', label: 'Diagnóstico' },
  { value: 'treatment', label: 'Tratamiento' },
  { value: 'surgery', label: 'Cirugía' },
  { value: 'procedure', label: 'Procedimiento' },
] as const;

export function InferentialStep({
  variables,
  onRun,
  onBack,
  isLoading,
}: InferentialStepProps) {
  const [domain, setDomain] = useState<string>('treatment');
  const [elementIds, setElementIds] = useState<string>('');
  const [outcome, setOutcome] = useState<string>('');
  const [correction, setCorrection] = useState<CorrectionMethod | ''>('');
  const [alpha, setAlpha] = useState(0.05);

  const isValid = domain && elementIds.trim().length > 0 && outcome;

  // Variables por defecto cuando no hay variables cargadas
  const defaultVariables = [
    'age',
    'sex',
    'bloodType',
    'hospitalStayDays',
    'surgeryDurationMinutes',
  ];

  const availableVariables = variables.length > 0 ? variables : defaultVariables;

  const handleRun = () => {
    if (!isValid) return;
    const elements = elementIds.split(',').map((s) => s.trim()).filter(Boolean);
    onRun({
      path: 'inferential',
      variables: [],
      exposure: { domain, elementIds: elements },
      outcome,
      correction: correction || undefined,
      alpha,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Análisis inferencial</h2>
        <p className="text-sm text-muted-foreground">
          Configure la exposición, el resultado y las opciones de corrección.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        {/* Exposure domain */}
        <div>
          <label className="block text-sm font-medium">Dominio de exposición</label>
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {EXPOSURE_DOMAINS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        {/* Exposure elements */}
        <div>
          <label className="block text-sm font-medium">
            Elementos de exposición (separados por coma)
          </label>
          <input
            type="text"
            value={elementIds}
            onChange={(e) => setElementIds(e.target.value)}
            placeholder="ej: omeprazol, levogastrol"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Puede añadir uno o varios elementos para comparar
          </p>
        </div>

        {/* Outcome */}
        <div>
          <label className="block text-sm font-medium">Variable resultado</label>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">— Seleccione —</option>
            {availableVariables.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          {variables.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Mostrando variables comunes. Para ver todas las variables disponibles, ejecute primero una consulta de investigación.
            </p>
          )}
        </div>

        {/* Correction */}
        <div>
          <label className="block text-sm font-medium">
            Corrección por comparaciones múltiples (opcional)
          </label>
          <select
            value={correction}
            onChange={(e) => setCorrection(e.target.value as CorrectionMethod | '')}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Sin corrección</option>
            <option value="holm">Holm (step-down Bonferroni)</option>
            <option value="fdr">Benjamini-Hochberg (FDR)</option>
          </select>
        </div>

        {/* Alpha */}
        <div>
          <label className="block text-sm font-medium">Nivel de significancia (α)</label>
          <input
            type="number"
            value={alpha}
            onChange={(e) => setAlpha(Number(e.target.value))}
            min={0.001}
            max={0.1}
            step={0.01}
            className="mt-1 w-32 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
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
          disabled={!isValid || isLoading}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading ? 'Analizando…' : 'Ejecutar análisis'}
        </button>
      </div>
    </div>
  );
}
