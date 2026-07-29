'use client';

// apps/web/src/components/research/TableOneBuilder/StatOverrideToggle.tsx
// Manual statistic override for a Table-1 variable (task 2.19). The auto
// detector (TableOneService → Python describe-auto) chooses mean±SD vs
// median(IQR); this toggle lets the researcher force one or revert to auto.

export interface StatOverrideToggleProps {
  field: string;
  /** Current override: 'mean_sd' | 'median_iqr' | '' (auto). */
  value?: 'mean_sd' | 'median_iqr' | '';
  onChange: (value: 'mean_sd' | 'median_iqr' | '') => void;
}

const OPTIONS: Array<{ key: 'mean_sd' | 'median_iqr' | ''; label: string }> = [
  { key: '', label: 'Auto' },
  { key: 'mean_sd', label: 'Media ± DE' },
  { key: 'median_iqr', label: 'Mediana (IQR)' },
];

export function StatOverrideToggle({ field, value, onChange }: StatOverrideToggleProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="min-w-[14ch] font-medium text-on-surface">{field}</span>
      <div role="radiogroup" aria-label={`Estadístico para ${field}`} className="flex gap-1">
        {OPTIONS.map((opt) => {
          const active = (value ?? '') === opt.key;
          return (
            <button
              key={opt.key || 'auto'}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.key)}
              className={
                'rounded border px-2 py-0.5 text-xs ' +
                (active
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-outline text-on-surface-variant hover:bg-surface-low')
              }
              data-testid={`override-${field}-${opt.key || 'auto'}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default StatOverrideToggle;