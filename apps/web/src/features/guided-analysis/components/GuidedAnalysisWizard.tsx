// apps/web/src/features/guided-analysis/components/GuidedAnalysisWizard.tsx
// Two-path wizard: Path 1 (descriptive) → Path 2 (inferential).
// Shared cohort context, automatic test selection, rationale display.

'use client';

import { useState, useCallback } from 'react';
import type {
  GuidedAnalysisRequest,
  GuidedAnalysisResult,
  GuidedAnalysisPath,
} from '@medicore/contracts';
import { useGuidedAnalysis } from '../api/useGuidedAnalysis';
import { PathSelector } from './PathSelector';
import { DescriptiveStep } from './DescriptiveStep';
import { InferentialStep } from './InferentialStep';
import { ResultsPanel } from './ResultsPanel';

interface GuidedAnalysisWizardProps {
  queryId: string;
  cohortSize: number;
  availableVariables: string[];
}

type WizardStep = 'path' | 'config' | 'results';

export function GuidedAnalysisWizard({
  queryId,
  cohortSize,
  availableVariables,
}: GuidedAnalysisWizardProps) {
  const [step, setStep] = useState<WizardStep>('path');
  const [path, setPath] = useState<GuidedAnalysisPath | null>(null);
  const [result, setResult] = useState<GuidedAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useGuidedAnalysis();

  const handlePathSelect = useCallback((selectedPath: GuidedAnalysisPath) => {
    setPath(selectedPath);
    setStep('config');
    setError(null);
  }, []);

  const handleRunAnalysis = useCallback(
    async (request: Omit<GuidedAnalysisRequest, 'queryId'>) => {
      setError(null);
      try {
        const res = await mutation.mutateAsync({ queryId, ...request });
        setResult(res);
        setStep('results');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Analysis failed');
      }
    },
    [queryId, mutation],
  );

  const handleBack = useCallback(() => {
    if (step === 'results') {
      setStep('config');
      setResult(null);
    } else if (step === 'config') {
      setStep('path');
      setPath(null);
    }
  }, [step]);

  const handleRestart = useCallback(() => {
    setStep('path');
    setPath(null);
    setResult(null);
    setError(null);
  }, []);

  if (cohortSize === 0) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
        <h3 className="text-lg font-semibold text-destructive">Cohort vacía</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          No se puede realizar el análisis guiado con una cohorte vacía.
          Ejecute primero una consulta con resultados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className={step === 'path' ? 'font-semibold text-foreground' : ''}>
          1. Ruta
        </span>
        <span>→</span>
        <span className={step === 'config' ? 'font-semibold text-foreground' : ''}>
          2. Configuración
        </span>
        <span>→</span>
        <span className={step === 'results' ? 'font-semibold text-foreground' : ''}>
          3. Resultados
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {step === 'path' && (
        <PathSelector
          onSelect={handlePathSelect}
          cohortSize={cohortSize}
        />
      )}

      {step === 'config' && path === 'descriptive' && (
        <DescriptiveStep
          variables={availableVariables}
          onRun={handleRunAnalysis}
          onBack={handleBack}
          isLoading={mutation.isPending}
        />
      )}

      {step === 'config' && path === 'inferential' && (
        <InferentialStep
          variables={availableVariables}
          onRun={handleRunAnalysis}
          onBack={handleBack}
          isLoading={mutation.isPending}
        />
      )}

      {step === 'results' && result && (
        <ResultsPanel
          result={result}
          onBack={handleBack}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
}
