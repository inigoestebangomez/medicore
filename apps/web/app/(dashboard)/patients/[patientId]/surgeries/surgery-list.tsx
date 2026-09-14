'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useSurgeries } from '@/hooks/useSurgeries';
import type { SurgeryStatus } from '@medicore/contracts';

const STATUS_BADGE: Record<SurgeryStatus, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  POSTPONED: 'bg-surface-container text-on-surface',
};

const STATUS_LABEL: Record<SurgeryStatus, string> = {
  SCHEDULED: 'Programada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  POSTPONED: 'Aplazada',
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-outline-variant border-t-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
        Error al cargar las cirugías: {error.message}
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-on-surface">Cirugías</h2>
        <Button
          size="sm"
          onClick={() => router.push(`/patients/${patientId}/surgeries/new`)}
        >
          Nueva cirugía
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-outline-variant bg-surface-lowest p-8 text-center">
          <p className="text-sm text-on-surface-variant">Todavía no hay cirugías registradas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((surgery) => (
            <div
              key={surgery.id}
              onClick={() => router.push(`/patients/${patientId}/surgeries/${surgery.id}`)}
              className="cursor-pointer rounded-lg border border-outline-variant bg-surface-lowest p-4 hover:bg-surface-low transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-on-surface">
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
                  <p className="text-sm text-on-surface-variant">
                    {surgery.procedureType}
                  </p>
                  {surgery.asa && (
                    <p className="text-xs text-on-surface-variant/60">
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
