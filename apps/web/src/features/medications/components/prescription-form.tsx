// apps/web/src/features/medications/components/prescription-form.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCreatePrescriptionWithOverride } from '../hooks/useMedications';
import type { CreatePrescriptionInput } from '../hooks/useMedications';

interface PrescriptionFormProps {
  patientId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PrescriptionForm({ patientId, onSuccess, onCancel }: PrescriptionFormProps) {
  const createMutation = useCreatePrescriptionWithOverride(patientId);

  const [form, setForm] = useState<CreatePrescriptionInput>({
    drugName: '',
    dosage: '',
    frequency: '',
    startDate: new Date().toISOString().slice(0, 16),
  });

  const [allergyOverride, setAllergyOverride] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allergyWarning, setAllergyWarning] = useState<{ level: string; substances: string[] } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAllergyWarning(null);

    try {
      const result = await createMutation.mutateAsync({ data: form, overrideAllergy: allergyOverride });

      if (result.allergyWarning) {
        setAllergyWarning(result.allergyWarning);
      } else {
        onSuccess?.();
      }
    } catch (err: any) {
      const message = err?.message ?? 'Failed to create prescription';
      if (message.includes('ALLERGY_CONFLICT_CRITICAL')) {
        setError('Critical allergy detected. Check the override checkbox to proceed with caution.');
      } else {
        setError(message);
      }
    }
  };

  const updateField = (field: keyof CreatePrescriptionInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold">New Prescription</h3>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {allergyWarning && (
        <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
          <p className="font-semibold">
            Allergy Warning ({allergyWarning.level})
          </p>
          <p>Matched substances: {allergyWarning.substances.join(', ')}</p>
          <label className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={allergyOverride}
              onChange={(e) => setAllergyOverride(e.target.checked)}
            />
            Override critical allergy (proceed with caution)
          </label>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Drug Name *</label>
          <input
            type="text"
            required
            value={form.drugName}
            onChange={(e) => updateField('drugName', e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Amoxicillin"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Active Ingredient</label>
          <input
            type="text"
            value={form.activeIngredient ?? ''}
            onChange={(e) => updateField('activeIngredient', e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            placeholder="amoxicillin"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium">Dosage *</label>
          <input
            type="text"
            required
            value={form.dosage}
            onChange={(e) => updateField('dosage', e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            placeholder="500mg"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Frequency *</label>
          <input
            type="text"
            required
            value={form.frequency}
            onChange={(e) => updateField('frequency', e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            placeholder="every 8 hours"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Route</label>
          <select
            value={form.route ?? ''}
            onChange={(e) => updateField('route', e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">—</option>
            <option value="oral">Oral</option>
            <option value="topical">Topical</option>
            <option value="intranasal">Intranasal</option>
            <option value="IV">IV</option>
            <option value="IM">IM</option>
            <option value="subcutaneous">Subcutaneous</option>
            <option value="inhaled">Inhaled</option>
            <option value="otic">Otic</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Start Date *</label>
          <input
            type="datetime-local"
            required
            value={form.startDate.slice(0, 16)}
            onChange={(e) => updateField('startDate', new Date(e.target.value).toISOString())}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">End Date</label>
          <input
            type="datetime-local"
            value={form.endDate ? form.endDate.slice(0, 16) : ''}
            onChange={(e) => updateField('endDate', e.target.value ? new Date(e.target.value).toISOString() : '')}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Duration</label>
          <input
            type="text"
            value={form.duration ?? ''}
            onChange={(e) => updateField('duration', e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            placeholder="7 days"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Form</label>
          <input
            type="text"
            value={form.form ?? ''}
            onChange={(e) => updateField('form', e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            placeholder="tablets, capsules"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Reason / Indication</label>
        <input
          type="text"
          value={form.reason ?? ''}
          onChange={(e) => updateField('reason', e.target.value)}
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Chronic sinusitis"
        />
      </div>

      <div>
        <label className="text-sm font-medium">Instructions</label>
        <textarea
          value={form.instructions ?? ''}
          onChange={(e) => updateField('instructions', e.target.value)}
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          rows={2}
          placeholder="Take with food. Avoid alcohol."
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
          {createMutation.isPending ? 'Creating...' : 'Create Prescription'}
        </Button>
      </div>
    </form>
  );
}