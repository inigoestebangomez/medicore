// apps/web/app/(dashboard)/patients/[patientId]/medications/page.tsx
'use client';

import { useState } from 'react';
import { MedicationList, PrescriptionForm, DiscontinuationModal } from '@/features/medications/components';
import type { MedicationPrescriptionResponse } from '@/features/medications/hooks/useMedications';

interface PageProps {
  params: { patientId: string };
}

export default function MedicationsPage({ params }: PageProps) {
  const [showForm, setShowForm] = useState(false);
  const [discontinueTarget, setDiscontinueTarget] = useState<MedicationPrescriptionResponse | null>(null);

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Medications</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
        >
          {showForm ? 'Cancel' : 'New Prescription'}
        </button>
      </div>

      {showForm && (
        <PrescriptionForm
          patientId={params.patientId}
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

      <MedicationList
        patientId={params.patientId}
        onDiscontinue={(medicationId) => {
          // The list does not return the full record; we open the modal with the id
          // and a placeholder name which the modal can refine.
          setDiscontinueTarget({ id: medicationId, drugName: '' } as MedicationPrescriptionResponse);
        }}
      />

      {discontinueTarget && (
        <DiscontinuationModal
          patientId={params.patientId}
          medicationId={discontinueTarget.id}
          drugName={discontinueTarget.drugName || 'this medication'}
          onSuccess={() => setDiscontinueTarget(null)}
          onCancel={() => setDiscontinueTarget(null)}
        />
      )}
    </div>
  );
}