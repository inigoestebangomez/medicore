// apps/web/app/(dashboard)/patients/[patientId]/imaging/page.tsx
// Imaging studies list for a patient, with a "New study" modal.

'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ImagingStudyList } from '@/components/imaging/imaging-study-list';
import { CreateStudyModal } from './create-study-modal';

export default function PatientImagingPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-on-surface">Estudios de imagenología</h2>
        <Button
          size="sm"
          onClick={() => setShowCreate(true)}
        >
          Nuevo estudio
        </Button>
      </div>

      <ImagingStudyList patientId={patientId} />

      {showCreate && (
        <CreateStudyModal
          patientId={patientId}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}