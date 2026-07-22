// apps/web/src/features/scales/components/scale-input-form.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCreateScale } from '../hooks/useScales';
import type { ClinicalScaleType } from '@medicore/contracts';

const SCALE_TYPES: { value: ClinicalScaleType; label: string; itemCount?: number; maxScore?: number }[] = [
  { value: 'SNOT_22', label: 'SNOT-22', itemCount: 22, maxScore: 5 },
  { value: 'VAS_TINNITUS', label: 'VAS Tinnitus', itemCount: 1, maxScore: 10 },
  { value: 'DHI', label: 'DHI', itemCount: 25, maxScore: 4 },
  { value: 'VHI', label: 'VHI', itemCount: 10, maxScore: 4 },
  { value: 'RSI', label: 'RSI', itemCount: 9, maxScore: 5 },
  { value: 'OSA_EPWORTH', label: 'Epworth Sleepiness', itemCount: 8, maxScore: 3 },
  { value: 'STOPBANG', label: 'STOP-BANG', itemCount: 8, maxScore: 1 },
  { value: 'NOSE', label: 'NOSE', itemCount: 5, maxScore: 4 },
  { value: 'CUSTOM', label: 'Custom' },
];

interface ScaleInputFormProps {
  patientId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ScaleInputForm({ patientId, onSuccess, onCancel }: ScaleInputFormProps) {
  const createMutation = useCreateScale(patientId);
  const [selectedType, setSelectedType] = useState<ClinicalScaleType>('SNOT_22');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  const scaleConfig = SCALE_TYPES.find((s) => s.value === selectedType)!;
  const isCustom = selectedType === 'CUSTOM';

  // Initialize scores for predefined scales
  const initializeScores = (type: ClinicalScaleType) => {
    const config = SCALE_TYPES.find((s) => s.value === type);
    if (!config || type === 'CUSTOM') {
      setScores({});
      return;
    }
    if (config.itemCount) {
      const initial: Record<string, number> = {};
      for (let i = 1; i <= config.itemCount; i++) {
        initial[`item_${i}`] = 0;
      }
      setScores(initial);
    }
  };

  const handleScoreChange = (key: string, value: string) => {
    const numVal = parseFloat(value);
    if (!isNaN(numVal)) {
      setScores((prev) => ({ ...prev, [key]: numVal }));
    }
  };

  const handleAddCustomItem = () => {
    const key = `custom_${Object.keys(scores).length + 1}`;
    setScores((prev) => ({ ...prev, [key]: 0 }));
  };

  const handleRemoveCustomItem = (key: string) => {
    setScores((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (Object.keys(scores).length === 0) {
      setError('At least one score is required.');
      return;
    }

    try {
      await createMutation.mutateAsync({
        scaleType: selectedType,
        date: new Date(date).toISOString(),
        scores,
        notes: notes || undefined,
      });
      onSuccess?.();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create scale');
    }
  };

  const calculatedTotal = Object.values(scores).reduce((sum, v) => sum + v, 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold">New Clinical Scale</h3>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Scale Type</label>
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value as ClinicalScaleType);
              initializeScores(e.target.value as ClinicalScaleType);
            }}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          >
            {SCALE_TYPES.map((st) => (
              <option key={st.value} value={st.value}>
                {st.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            Scores {scaleConfig.itemCount ? `(${scaleConfig.itemCount} items, 0–${scaleConfig.maxScore})` : ''}
          </label>
          <span className="text-sm font-medium">
            Total: <strong>{calculatedTotal}</strong>
          </span>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {Object.entries(scores).map(([key, value]) => (
            <div key={key} className="flex items-center gap-1">
              <label className="text-xs text-muted-foreground w-16 truncate" title={key}>
                {isCustom ? (
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => {
                      const newScores = { ...scores };
                      const val = newScores[key];
                      delete newScores[key];
                      newScores[e.target.value] = val;
                      setScores(newScores);
                    }}
                    className="w-full rounded border px-1 py-0.5 text-xs"
                  />
                ) : (
                  key.replace('item_', '#')
                )}
              </label>
              <input
                type="number"
                min={0}
                max={scaleConfig.maxScore ?? 100}
                value={value}
                onChange={(e) => handleScoreChange(key, e.target.value)}
                className="w-16 rounded border px-1 py-0.5 text-sm"
              />
              {isCustom && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveCustomItem(key)}
                  className="h-6 w-6 text-xs text-destructive"
                >
                  ×
                </Button>
              )}
            </div>
          ))}
        </div>

        {isCustom && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddCustomItem}
          >
            + Add Item
          </Button>
        )}
      </div>

      <div>
        <label className="text-sm font-medium">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          rows={2}
          placeholder="Optional notes about this assessment"
        />
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? 'Creating...' : 'Create Scale'}
        </Button>
      </div>
    </form>
  );
}