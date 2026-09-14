// apps/web/src/features/guided-analysis/components/ResultsPanel.tsx
// Displays guided analysis results: rationale, statistics, effect measures,
// warnings, corrections. p<0.05 is framed as convention, not decision rule.

'use client';

import type { GuidedAnalysisResult } from '@medicore/contracts';

interface ResultsPanelProps {
  result: GuidedAnalysisResult;
  onBack: () => void;
  onRestart: () => void;
}

export function ResultsPanel({ result, onBack, onRestart }: ResultsPanelProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Resultados del análisis</h2>
          <p className="text-sm text-muted-foreground">
            Cohorte n={result.cohort.n} · Ruta: {result.path === 'descriptive' ? 'Descriptiva' : 'Inferencial'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-secondary"
          >
            Modificar
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-secondary"
          >
            Nuevo análisis
          </button>
        </div>
      </div>

      {/* Rationale */}
      {result.rationale.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
          <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200">
            Justificación estadística
          </h3>
          {result.rationale.map((r, i) => (
            <p key={i} className="mt-1 text-sm text-blue-700 dark:text-blue-300">
              {r}
            </p>
          ))}
        </div>
      )}

      {/* Descriptive summaries */}
      {result.summaries.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Resúmenes descriptivos</h3>
          {result.summaries.map((s, i) => (
            <div key={i} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{s.variable}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                  {s.kind === 'quantitative' ? 'Cuantitativa' : 'Cualitativa'}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                n={s.n} · faltantes={s.missing}
              </p>
              {s.suppressed ? (
                <p className="mt-2 text-sm text-destructive">
                  [Suprimido: {s.suppressReason}]
                </p>
              ) : s.kind === 'quantitative' ? (
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div>Media: {s.mean ?? '—'}</div>
                  <div>DE: {s.sd ?? '—'}</div>
                  <div>Mediana: {s.median ?? '—'}</div>
                  <div>Rango: {s.min ?? '—'}–{s.max ?? '—'}</div>
                </div>
              ) : (
                <div className="mt-2 space-y-1">
                  {s.categories.map((cat, j) => (
                    <div key={j} className="flex justify-between text-sm">
                      <span>{cat.label}</span>
                      <span className="text-muted-foreground">
                        {cat.count} ({cat.percent}%)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Inferential results */}
      {result.results.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Resultados inferenciales</h3>
          {result.results.map((r, i) => (
            <div key={i} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.test}</span>
                {r.variable && (
                  <span className="text-sm text-muted-foreground">{r.variable}</span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                <div>Estadístico: {r.statistic ?? '—'}</div>
                <div>
                  valor p: {r.pValue !== null ? r.pValue.toFixed(4) : '—'}
                </div>
                {r.groups.length > 0 && (
                  <div>
                    Grupos: {r.groups.map((g) => `${g.key} (n=${g.n})`).join(', ')}
                  </div>
                )}
              </div>

              {/* Effect measures */}
              {r.effectMeasures.length > 0 && (
                <div className="mt-3 space-y-1">
                  <span className="text-sm font-medium">Medidas de efecto:</span>
                  {r.effectMeasures.map((em, j) => (
                    <div key={j} className="text-sm">
                      {em.suppressed ? (
                        <span className="text-destructive">
                          {em.name}: [Suprimido — {em.suppressReason ?? 'celdas inseguras'}]
                        </span>
                      ) : (
                        <span>
                          {em.name}: {em.value?.toFixed(3)}
                          {em.ci95Lower !== null && em.ci95Upper !== null && (
                            <span className="text-muted-foreground">
                              {' '}[IC 95%: {em.ci95Lower.toFixed(3)}–{em.ci95Upper.toFixed(3)}]
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {r.warnings.length > 0 && (
                <div className="mt-2 space-y-1">
                  {r.warnings.map((w, j) => (
                    <p key={j} className="text-xs text-amber-600 dark:text-amber-400">
                      ⚠ [{w.code}] {w.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Corrections */}
      {result.corrections.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Correcciones por comparaciones múltiples</h3>
          {result.corrections.map((c, i) => (
            <div key={i} className="rounded-lg border border-border p-3 text-sm">
              <span className="font-medium">{c.method.toUpperCase()}</span>
              <span className="ml-2 text-muted-foreground">
                p original={c.originalP?.toFixed(4) ?? '—'} → p ajustado={c.adjustedP?.toFixed(4) ?? '—'}
              </span>
              {c.label && <p className="mt-1 text-xs text-muted-foreground">{c.label}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            Advertencias
          </h3>
          {result.warnings.map((w, i) => (
            <div key={i} className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              <span className="font-medium">[{w.code}]</span> {w.message}
              {w.suggestion && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Sugerencia: {w.suggestion}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* p-value disclaimer */}
      <div className="rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
        <strong>Nota:</strong> Los valores p se presentan como una convención
        estadística, no como una regla de decisión clínica independiente.
        La interpretación clínica requiere contexto adicional.
      </div>
    </div>
  );
}
