// apps/web/src/features/guided-analysis/components/InferentialStep.tsx
// Path 2 configuration: exposure domain, elements, outcome, correction.

'use client';

import { useState } from 'react';
import type { GuidedAnalysisRequest, CorrectionMethod } from '@medicore/contracts';
import { VariablePicker } from './VariablePicker';

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
  variables: _variables,
  onRun,
  onBack,
  isLoading,
}: InferentialStepProps) {
  const [domain, setDomain] = useState<string>('treatment');
  const [elements, setElements] = useState<string[]>([]);
  const [outcomes, setOutcomes] = useState<string[]>([]);
  const [correction, setCorrection] = useState<CorrectionMethod | ''>('');
  const [alpha, setAlpha] = useState(0.05);

  const isValid = domain && elements.length > 0 && outcomes.length > 0;

  const handleAddCustomVariable = (variableName: string) => {
    // Add custom variable to outcomes
    if (!outcomes.includes(variableName)) {
      setOutcomes([...outcomes, variableName]);
    }
  };

  const handleRun = () => {
    if (!isValid) return;
    onRun({
      path: 'inferential',
      variables: outcomes,
      exposure: { domain, elementIds: elements },
      outcome: outcomes[0], // Use first outcome as primary
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
            onChange={(e) => {
              setDomain(e.target.value);
              setElements([]);
            }}
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
            Elementos de exposición
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Seleccione uno o varios elementos del dominio "{EXPOSURE_DOMAINS.find((d) => d.value === domain)?.label}"
          </p>
          <div className="mt-2">
            <VariablePicker
              value={elements}
              onChange={(v) => setElements(Array.isArray(v) ? v : [])}
              multi
              placeholder="Seleccione elementos de exposición"
              searchPlaceholder="Buscar elemento…"
            />
          </div>
        </div>

        {/* Outcome */}
        <div>
          <label className="block text-sm font-medium">Variables resultado</label>
          <p className="mt-1 text-xs text-muted-foreground">
            Seleccione una o varias variables para analizar
          </p>
          <div className="mt-2">
            <VariablePicker
              value={outcomes}
              onChange={(v) => setOutcomes(Array.isArray(v) ? v : v ? [v] : [])}
              multi
              placeholder="Seleccione variables resultado"
              searchPlaceholder="Buscar variable…"
              onAddCustom={handleAddCustomVariable}
            />
          </div>
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
