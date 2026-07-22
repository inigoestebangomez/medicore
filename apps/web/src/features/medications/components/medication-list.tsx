// apps/web/src/features/medications/components/medication-list.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useMedications } from '../hooks/useMedications';
import type { MedicationStatus } from '@medicore/contracts';

const STATUS_OPTIONS: { value: MedicationStatus | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DISCONTINUED', label: 'Discontinued' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ON_HOLD', label: 'On Hold' },
];

const statusBadgeClasses: Record<MedicationStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  DISCONTINUED: 'bg-red-100 text-red-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
  ON_HOLD: 'bg-yellow-100 text-yellow-800',
};

interface MedicationListProps {
  patientId: string;
  onEdit?: (medicationId: string) => void;
  onDiscontinue?: (medicationId: string) => void;
  onCreate?: () => void;
}

export function MedicationList({ patientId, onEdit, onDiscontinue, onCreate }: MedicationListProps) {
  const [status, setStatus] = useState<MedicationStatus | undefined>(undefined);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading, error } = useMedications(patientId, { status, page, pageSize });

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading medications...</div>;
  }

  if (error) {
    return <div className="p-4 text-sm text-destructive">Error: {error.message}</div>;
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Medications</h3>
          <select
            className="rounded-md border px-2 py-1 text-sm"
            value={status ?? ''}
            onChange={(e) => {
              setStatus(e.target.value as MedicationStatus || undefined);
              setPage(1);
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value ?? ''}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {onCreate && (
          <Button
            size="sm"
            onClick={onCreate}
          >
            Add Medication
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No medications found.</p>
      ) : (
        <div className="space-y-2">
          {items.map((med) => (
            <div
              key={med.id}
              className="rounded-lg border p-4 hover:bg-muted/50 cursor-pointer"
              onClick={() => onEdit?.(med.id)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{med.drugName}</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClasses[med.status]}`}>
                      {med.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {med.dosage} — {med.frequency}
                    {med.route ? ` (${med.route})` : ''}
                  </p>
                  {med.activeIngredient && med.activeIngredient !== med.drugName && (
                    <p className="text-xs text-muted-foreground">Active ingredient: {med.activeIngredient}</p>
                  )}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Started: {new Date(med.startDate).toLocaleDateString()}</p>
                  {med.endDate && <p>Ends: {new Date(med.endDate).toLocaleDateString()}</p>}
                  {med.discontinuationReason && (
                    <p className="text-red-600">Reason: {med.discontinuationReason}</p>
                  )}
                </div>
              </div>
              {med.status === 'ACTIVE' && onDiscontinue && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDiscontinue(med.id);
                  }}
                  className="mt-2 text-xs text-red-600 hover:underline"
                >
                  Discontinue
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}