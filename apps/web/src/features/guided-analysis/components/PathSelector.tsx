// apps/web/src/features/guided-analysis/components/PathSelector.tsx
// Step 1: Choose between descriptive (Path 1) and inferential (Path 2).

'use client';

import type { GuidedAnalysisPath } from '@medicore/contracts';

interface PathSelectorProps {
  onSelect: (path: GuidedAnalysisPath) => void;
  cohortSize: number;
}

export function PathSelector({ onSelect, cohortSize }: PathSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Análisis estadístico guiado</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cohorte: {cohortSize} pacientes. Seleccione el tipo de análisis.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Path 1: Descriptive */}
        <button
          type="button"
          onClick={() => onSelect('descriptive')}
          className="group rounded-lg border border-border bg-card p-6 text-left transition hover:border-primary hover:shadow-md"
        >
          <h3 className="text-lg font-semibold group-hover:text-primary">
            Ruta 1: Análisis descriptivo
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Describa las características de su cohorte: medias, medianas,
            distribuciones, frecuencias y gráficos.
          </p>
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            <li>• Variables cuantitativas y cualitativas</li>
            <li>• Medidas de tendencia central y dispersión</li>
            <li>• Gráficos apropiados por tipo de variable</li>
          </ul>
        </button>

        {/* Path 2: Inferential */}
        <button
          type="button"
          onClick={() => onSelect('inferential')}
          className="group rounded-lg border border-border bg-card p-6 text-left transition hover:border-primary hover:shadow-md"
        >
          <h3 className="text-lg font-semibold group-hover:text-primary">
            Ruta 2: Análisis inferencial
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Compare grupos o evalúe exposiciones: selección automática de
            pruebas, medidas de efecto (RR/OR), valores p y correcciones.
          </p>
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            <li>• Selección automática de prueba estadística</li>
            <li>• Riesgo relativo (RR) y odds ratio (OR)</li>
            <li>• Corrección Holm / FDR para comparaciones múltiples</li>
            <li>• Rationale clínico legible</li>
          </ul>
        </button>
      </div>
    </div>
  );
}
