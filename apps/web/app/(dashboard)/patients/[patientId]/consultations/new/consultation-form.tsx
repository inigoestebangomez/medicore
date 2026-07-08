'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateConsultation } from '@/hooks/useConsultations';
import { DiagnosisCodePicker } from '@/features/consultations/components/diagnosis-code-picker';
import { DynamicForm } from '@/features/consultations/components/dynamic-form';
import { ORL_PHYSICAL_EXAM_TEMPLATE } from '@/features/consultations/components/orl-physical-exam-template';
import type { CreateConsultationInput, DiagnosisCode, ConsultationType } from '@medicore/contracts';

const CONSULTATION_TYPES: { value: ConsultationType; label: string }[] = [
  { value: 'FIRST_VISIT', label: 'First Visit' },
  { value: 'FOLLOW_UP', label: 'Follow-up' },
  { value: 'URGENCY', label: 'Urgency' },
  { value: 'POST_OP', label: 'Post-Op' },
  { value: 'TELECONSULTATION', label: 'Teleconsultation' },
];

function toISODateTime(value: string): string {
  return new Date(value).toISOString();
}

interface ConsultationFormProps {
  patientId: string;
}

export function ConsultationForm({ patientId }: ConsultationFormProps) {
  const router = useRouter();
  const createMutation = useCreateConsultation(patientId);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 16),
    type: 'FIRST_VISIT' as ConsultationType,
    chiefComplaint: '',
    currentIllness: '',
    assessment: '',
    plan: '',
    followUpDate: '',
    followUpNotes: '',
  });

  const [physicalExam, setPhysicalExam] = useState<Record<string, unknown>>({});
  const [diagnosisCodes, setDiagnosisCodes] = useState<DiagnosisCode[]>([]);
  const [error, setError] = useState<string | null>(null);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.chiefComplaint.length < 3) {
      setError('Chief complaint must be at least 3 characters');
      return;
    }

    const payload: CreateConsultationInput = {
      date: toISODateTime(form.date),
      type: form.type,
      chiefComplaint: form.chiefComplaint,
      currentIllness: form.currentIllness || undefined,
      physicalExam: Object.keys(physicalExam).length > 0 ? physicalExam : undefined,
      assessment: form.assessment || undefined,
      plan: form.plan || undefined,
      diagnosisCodes: diagnosisCodes.length > 0 ? diagnosisCodes : undefined,
      followUpDate: form.followUpDate ? toISODateTime(form.followUpDate) : undefined,
      followUpNotes: form.followUpNotes || undefined,
      generateReport: false,
    };

    try {
      await createMutation.mutateAsync(payload);
      router.push(`/patients/${patientId}/consultations`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create consultation';
      setError(message);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">New Consultation</h2>
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-5">
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
              <label className="text-sm font-medium">Type</label>
              <select
                value={form.type}
                onChange={(e) => updateField('type', e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              >
                {CONSULTATION_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Chief Complaint *</label>
            <textarea
              required
              value={form.chiefComplaint}
              onChange={(e) => updateField('chiefComplaint', e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              rows={3}
              placeholder="Describe the patient's chief complaint..."
            />
          </div>

          <div>
            <label className="text-sm font-medium">History of Present Illness</label>
            <textarea
              value={form.currentIllness}
              onChange={(e) => updateField('currentIllness', e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              rows={3}
              placeholder="History of present illness..."
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Physical Exam (ORL)</h3>
            <DynamicForm
              template={ORL_PHYSICAL_EXAM_TEMPLATE}
              values={physicalExam}
              onChange={setPhysicalExam}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Assessment</label>
            <textarea
              value={form.assessment}
              onChange={(e) => updateField('assessment', e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              rows={3}
              placeholder="Clinical assessment..."
            />
          </div>

          <div>
            <label className="text-sm font-medium">Plan</label>
            <textarea
              value={form.plan}
              onChange={(e) => updateField('plan', e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              rows={3}
              placeholder="Treatment plan..."
            />
          </div>

          <DiagnosisCodePicker
            selected={diagnosisCodes}
            onChange={setDiagnosisCodes}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Follow-up Date</label>
              <input
                type="datetime-local"
                value={form.followUpDate}
                onChange={(e) => updateField('followUpDate', e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Follow-up Notes</label>
              <textarea
                value={form.followUpNotes}
                onChange={(e) => updateField('followUpNotes', e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                rows={2}
                placeholder="Notes for follow-up..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-md border px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Consultation'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
