// apps/web/src/features/medications/components/discontinuation-modal.tsx
// BR-MED-003: Discontinuation requires a reason

import { useState } from 'react';
import { useDiscontinueMedication } from '../hooks/useMedications';

interface DiscontinuationModalProps {
  patientId: string;
  medicationId: string;
  drugName: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function DiscontinuationModal({ patientId, medicationId, drugName, onSuccess, onCancel }: DiscontinuationModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const discontinueMutation = useDiscontinueMedication(patientId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!reason.trim()) {
      setError('A discontinuation reason is required.');
      return;
    }

    try {
      await discontinueMutation.mutateAsync({
        medicationId,
        data: { discontinuationReason: reason.trim() },
      });
      onSuccess?.();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to discontinue medication');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
        <h3 className="text-lg font-semibold">Discontinue Medication</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Discontinuing: <strong>{drugName}</strong>
        </p>

        {error && (
          <div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium">
              Reason for discontinuation <span className="text-destructive">*</span>
            </label>
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              rows={3}
              placeholder="e.g., Adverse reaction: nausea, Patient request, Treatment completed"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              This reason will be permanently recorded in the prescription audit trail.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="rounded-md border px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={discontinueMutation.isPending || !reason.trim()}
              className="rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {discontinueMutation.isPending ? 'Discontinuing...' : 'Discontinue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}