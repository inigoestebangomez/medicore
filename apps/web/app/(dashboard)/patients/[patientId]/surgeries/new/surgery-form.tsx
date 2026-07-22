'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useCreateSurgery } from '@/hooks/useSurgeries';
import type { AsaClassification, SurgeryStatus } from '@medicore/contracts';

const ASA_OPTIONS: { value: AsaClassification; label: string }[] = [
  { value: 'ASA_I', label: 'ASA I — Healthy patient' },
  { value: 'ASA_II', label: 'ASA II — Mild systemic disease' },
  { value: 'ASA_III', label: 'ASA III — Severe systemic disease' },
  { value: 'ASA_IV', label: 'ASA IV — Life-threatening disease' },
  { value: 'ASA_V', label: 'ASA V — Moribund' },
  { value: 'ASA_VI', label: 'ASA VI — Brain dead organ donor' },
];

const STATUS_OPTIONS: { value: SurgeryStatus; label: string }[] = [
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'COMPLETED', label: 'Completed' },
];

function toISODateTime(value: string): string {
  return new Date(value).toISOString();
}

interface SurgeryFormProps {
  patientId: string;
}

export function SurgeryForm({ patientId }: SurgeryFormProps) {
  const router = useRouter();
  const createMutation = useCreateSurgery(patientId);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 16),
    procedureType: '',
    status: 'SCHEDULED' as SurgeryStatus,
    asa: '' as AsaClassification | '',
    anesthesiaType: '',
    duration: '',
    preOpNotes: '',
    findings: '',
    complications: '',
    postOpNotes: '',
    outcome: '',
  });

  const [error, setError] = useState<string | null>(null);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.procedureType.trim()) {
      setError('Procedure type is required');
      return;
    }

    if (!form.date) {
      setError('Date is required');
      return;
    }

    const payload = {
      date: toISODateTime(form.date),
      procedureType: form.procedureType.trim(),
      asa: form.asa || undefined,
      anesthesiaType: form.anesthesiaType.trim() || undefined,
      duration: form.duration ? parseInt(form.duration, 10) : undefined,
      preOpNotes: form.preOpNotes.trim() || undefined,
      findings: form.findings.trim() || undefined,
      complications: form.complications.trim() || undefined,
      postOpNotes: form.postOpNotes.trim() || undefined,
      outcome: form.outcome.trim() || undefined,
      generateReport: false,
    };

    try {
      await createMutation.mutateAsync(payload);
      router.push(`/patients/${patientId}/surgeries`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create surgery';
      setError(message);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-on-surface">New Surgery</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="rounded-lg border border-outline-variant bg-surface-lowest p-6 space-y-5">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Date *</label>
              <input
                type="datetime-local"
                required
                value={form.date}
                onChange={(e) => updateField('date', e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <select
                value={form.status}
                onChange={(e) => updateField('status', e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Procedure Type *</label>
            <input
              type="text"
              required
              value={form.procedureType}
              onChange={(e) => updateField('procedureType', e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="e.g. Septoplastia + CENS bilateral"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">ASA Classification</label>
              <select
                value={form.asa}
                onChange={(e) => updateField('asa', e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="">— Select —</option>
                {ASA_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Anesthesia Type</label>
              <input
                type="text"
                value={form.anesthesiaType}
                onChange={(e) => updateField('anesthesiaType', e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                placeholder="e.g. General, Local..."
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Duration (minutes)</label>
            <input
              type="number"
              min={1}
              value={form.duration}
              onChange={(e) => updateField('duration', e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="e.g. 120"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Pre-Op Notes</label>
            <textarea
              value={form.preOpNotes}
              onChange={(e) => updateField('preOpNotes', e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              rows={3}
              placeholder="Pre-operative notes..."
            />
          </div>

          <div>
            <label className="text-sm font-medium">Findings</label>
            <textarea
              value={form.findings}
              onChange={(e) => updateField('findings', e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              rows={3}
              placeholder="Surgical findings..."
            />
          </div>

          <div>
            <label className="text-sm font-medium">Complications</label>
            <textarea
              value={form.complications}
              onChange={(e) => updateField('complications', e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              rows={2}
              placeholder="Any complications..."
            />
          </div>

          <div>
            <label className="text-sm font-medium">Post-Op Notes</label>
            <textarea
              value={form.postOpNotes}
              onChange={(e) => updateField('postOpNotes', e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              rows={3}
              placeholder="Post-operative notes..."
            />
          </div>

          <div>
            <label className="text-sm font-medium">Outcome</label>
            <textarea
              value={form.outcome}
              onChange={(e) => updateField('outcome', e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              rows={2}
              placeholder="Surgical outcome..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Surgery'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
