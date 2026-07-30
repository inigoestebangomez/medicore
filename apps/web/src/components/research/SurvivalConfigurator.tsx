// apps/web/src/components/research/SurvivalConfigurator.tsx
// Survival analysis configurator (M5). Wraps the existing SurvivalCurve with a
// config panel: event type selector (recurrence/complication/reintervention/
// exitus/custom), time-from field, time-to field, and optional group field.
// The configured KM curve is rendered by SurvivalCurvePlot. Gated by
// RESEARCH_V3_VIZ — a fallback hint is shown when off.

'use client';

import { useState } from 'react';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useSurvivalTable, type SurvivalTableResult } from '@/hooks/useStudiesWithBadges';

const EVENT_TYPES = [
  { value: 'recurrence', label: 'Recurrencia' },
  { value: 'complication', label: 'Complicación' },
  { value: 'reintervention', label: 'Reintervención' },
  { value: 'exitus', label: 'Éxitus' },
  { value: 'custom', label: 'Campo personalizado' },
] as const;

export interface SurvivalConfiguratorProps {
  studyId: string;
  /** known field names for custom selectors */
  availableFields?: string[];
}

export function SurvivalConfigurator({ studyId, availableFields = [] }: SurvivalConfiguratorProps) {
  const enabled = useFeatureFlag('RESEARCH_V3_VIZ');
  const [eventType, setEventType] = useState<(typeof EVENT_TYPES)[number]['value']>('recurrence');
  const [timeField, setTimeField] = useState('followUpMonths');
  const [customEvent, setCustomEvent] = useState('');
  const table = useSurvivalTable();
  const result = (table.data ?? null) as SurvivalTableResult | null;

  if (!enabled) {
    return <p className="text-xs text-on-surface-variant">UI de supervivencia V3 deshabilitada (RESEARCH_V3_VIZ).</p>;
  }

  const effectiveEventField = eventType === 'custom' ? (customEvent || 'event') : `event_${eventType}`;

  async function generateTable() {
    await table.mutateAsync({
      studyId,
      timeField,
      eventField: eventType === 'custom' ? (customEvent || 'event') : `event_${eventType}`,
    });
  }

  function downloadCsv() {
    if (!result?.csv) return;
    const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `survival-table-${studyId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div data-testid="survival-configurator" className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="block text-xs font-semibold uppercase text-on-surface-variant">
          Tipo de evento
          <select
            aria-label="Tipo de evento"
            value={eventType}
            onChange={(e) => setEventType(e.target.value as typeof eventType)}
            className="mt-1 w-full rounded border border-outline px-2 py-1 text-sm"
          >
            {EVENT_TYPES.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </label>

        <label className="block text-xs font-semibold uppercase text-on-surface-variant">
          Campo tiempo
          <input
            list="survival-fields"
            aria-label="Campo tiempo"
            value={timeField}
            onChange={(e) => setTimeField(e.target.value)}
            className="mt-1 w-full rounded border border-outline px-2 py-1 text-sm"
          />
          <datalist id="survival-fields">
            {availableFields.map((f) => <option key={f} value={f} />)}
          </datalist>
        </label>

        {eventType === 'custom' ? (
          <label className="block text-xs font-semibold uppercase text-on-surface-variant">
            Campo evento personalizado
            <input
              aria-label="Campo evento personalizado"
              value={customEvent}
              onChange={(e) => setCustomEvent(e.target.value)}
              className="mt-1 w-full rounded border border-outline px-2 py-1 text-sm"
            />
          </label>
        ) : (
          <div className="text-xs text-on-surface-variant">
            Campo evento derivado: <code className="font-mono">{effectiveEventField}</code>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void generateTable()}
          disabled={table.isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary disabled:opacity-50"
        >
          {table.isPending ? 'Generando…' : 'Generar tabla de supervivencia'}
        </button>
        {result && (
          <button
            type="button"
            onClick={() => void downloadCsv()}
            className="rounded-md border border-outline px-3 py-1.5 text-sm font-semibold text-on-surface-variant hover:bg-surface-low"
            data-testid="download-csv"
          >
            Descargar CSV
          </button>
        )}
      </div>

      {result && (
        <div className="rounded-md border border-outline p-4" data-testid="survival-table">
          <h3 className="mb-2 text-sm font-semibold uppercase text-on-surface-variant">
            Supervivencia · n = {result.n}
            {result.medianSurvival !== null && ` · mediana ${result.medianSurvival}`}
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-low text-on-surface-variant">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Meses</th>
                  <th className="px-3 py-2 text-left font-medium">Supervivencia</th>
                  <th className="px-3 py-2 text-left font-medium">IC 95% inf</th>
                  <th className="px-3 py-2 text-left font-medium">IC 95% sup</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {result.rows.map((r) => (
                  <tr key={r.months}>
                    <td className="px-3 py-2">{r.months}</td>
                    <td className="px-3 py-2">{r.survival ?? '—'}</td>
                    <td className="px-3 py-2">{r.ciLower ?? '—'}</td>
                    <td className="px-3 py-2">{r.ciUpper ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.warnings.length > 0 && (
            <ul className="mt-2 text-xs text-on-surface-variant">
              {result.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default SurvivalConfigurator;