'use client';

import { useRouter } from 'next/navigation';
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary" />
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
        <h2 className="text-lg font-semibold text-gray-900">Consultations</h2>
        <button
          onClick={() => router.push(`/patients/${patientId}/consultations/new`)}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
        >
          New Consultation
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">No consultations recorded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((consultation) => (
            <div
              key={consultation.id}
              onClick={() => router.push(`/patients/${patientId}/consultations/${consultation.id}`)}
              className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
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
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {consultation.chiefComplaint}
                  </p>
                  {consultation.physicianName && (
                    <p className="text-xs text-gray-400">
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
