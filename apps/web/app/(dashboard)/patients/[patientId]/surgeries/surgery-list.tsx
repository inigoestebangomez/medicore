'use client';

import { useRouter } from 'next/navigation';
import { useSurgeries } from '@/hooks/useSurgeries';
import type { SurgeryStatus } from '@medicore/contracts';

const STATUS_BADGE: Record<SurgeryStatus, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  POSTPONED: 'bg-gray-100 text-gray-800',
};

const STATUS_LABEL: Record<SurgeryStatus, string> = {
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  POSTPONED: 'Postponed',
};

interface SurgeryListProps {
  patientId: string;
}

export function SurgeryList({ patientId }: SurgeryListProps) {
  const router = useRouter();
  const { data, isLoading, error } = useSurgeries(patientId, {
    sortBy: 'date',
    sortOrder: 'desc',
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
        Error loading surgeries: {error.message}
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Surgeries</h2>
        <button
          onClick={() => router.push(`/patients/${patientId}/surgeries/new`)}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
        >
          New Surgery
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">No surgeries recorded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((surgery) => (
            <div
              key={surgery.id}
              onClick={() => router.push(`/patients/${patientId}/surgeries/${surgery.id}`)}
              className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {new Date(surgery.date).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[surgery.status]}`}
                    >
                      {STATUS_LABEL[surgery.status]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {surgery.procedureType}
                  </p>
                  {surgery.asa && (
                    <p className="text-xs text-gray-400">
                      ASA: {surgery.asa.replace('_', ' ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
