'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useConsultations } from '@/hooks/useConsultations';
import type { ConsultationType } from '@medicore/contracts';

const TYPE_BADGE: Record<ConsultationType, string> = {
  FIRST_VISIT: 'bg-blue-100 text-blue-800',
  FOLLOW_UP: 'bg-green-100 text-green-800',
  URGENCY: 'bg-red-100 text-red-800',
  POST_OP: 'bg-purple-100 text-purple-800',
  TELECONSULTATION: 'bg-amber-100 text-amber-800',
};

const TYPE_LABEL: Record<ConsultationType, string> = {
  FIRST_VISIT: 'First Visit',
  FOLLOW_UP: 'Follow-up',
  URGENCY: 'Urgency',
  POST_OP: 'Post-Op',
  TELECONSULTATION: 'Teleconsultation',
};

interface ConsultationListProps {
  patientId: string;
}

export function ConsultationList({ patientId }: ConsultationListProps) {
  const router = useRouter();
  const { data, isLoading, error } = useConsultations(patientId, {
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
        Error loading consultations: {error.message}
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-on-surface">Consultations</h2>
        <Button
          size="sm"
          onClick={() => router.push(`/patients/${patientId}/consultations/new`)}
        >
          New Consultation
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-outline-variant bg-surface-lowest p-8 text-center">
          <p className="text-sm text-on-surface-variant">No consultations recorded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((consultation) => (
            <div
              key={consultation.id}
              onClick={() => router.push(`/patients/${patientId}/consultations/${consultation.id}`)}
              className="cursor-pointer rounded-lg border border-outline-variant bg-surface-lowest p-4 hover:bg-surface-low transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-on-surface">
                      {new Date(consultation.date).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_BADGE[consultation.type]}`}
                    >
                      {TYPE_LABEL[consultation.type]}
                    </span>
                  </div>
                  <p className="text-sm text-on-surface-variant line-clamp-2">
                    {consultation.chiefComplaint}
                  </p>
                  {consultation.physicianName && (
                    <p className="text-xs text-on-surface-variant/60">
                      Physician: {consultation.physicianName}
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
