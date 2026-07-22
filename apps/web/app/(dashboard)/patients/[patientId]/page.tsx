// apps/web/app/(dashboard)/patients/[patientId]/page.tsx
// Patient overview — shows all patient demographics, edit action, and clinical timeline.

'use client';

import { useParams } from 'next/navigation';
import { usePatient } from '@/hooks/usePatients';
import { ClinicalTimeline } from '@/features/patients/components/clinical-timeline';
import { PatientActions } from './patient-actions';
import { EditPatientModal } from './edit-patient-modal';

export default function PatientOverviewPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { data: patient, isLoading } = usePatient(patientId);

  if (isLoading) return <PatientSkeleton />;
  if (!patient) return <p className="py-6 text-sm text-on-surface-variant">Paciente no encontrado</p>;

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-on-surface">Resumen del paciente</h2>
        <EditPatientModal patient={patient} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FieldCard label="NHC" value={patient.nhc} />
        <FieldCard
          label="Nombre"
          value={`${patient.firstName} ${patient.lastName}`}
        />
        <FieldCard
          label="Fecha de nacimiento"
          value={
            patient.birthDate
              ? new Date(patient.birthDate).toLocaleDateString('es-ES')
              : '—'
          }
        />
        <FieldCard label="Sexo" value={formatSex(patient.sex)} />
        <FieldCard label="Teléfono" value={patient.phone ?? '—'} />
        <FieldCard label="Email" value={patient.email ?? '—'} />
        <FieldCard
          label="Documento"
          value={
            patient.idDocument
              ? `${patient.idDocType ?? ''} ${patient.idDocument}`.trim()
              : '—'
          }
        />
        <FieldCard label="Grupo sanguíneo" value={formatBloodType(patient.bloodType)} />
        <FieldCard
          label="Dirección"
          value={
            typeof patient.address === 'string'
              ? patient.address
              : formatAddress(patient.address)
          }
        />
        <FieldCard
          label="Contacto de emergencia"
          value={formatEmergencyContact(patient.emergencyContact)}
        />
        <FieldCard label="Notas" value={patient.notes ?? '—'} span={2} />
      </div>

      <PatientActions patientId={patientId} />

      <div>
        <h3 className="mb-4 text-base font-semibold text-on-surface">
          Cronología clínica
        </h3>
        <ClinicalTimeline patientId={patientId} />
      </div>
    </div>
  );
}

function FieldCard({
  label,
  value,
  span,
}: {
  label: string;
  value: string;
  span?: number;
}) {
  return (
    <div className={span === 2 ? 'md:col-span-2' : ''}>
      <div className="rounded-lg border border-outline-variant bg-surface-lowest p-4">
        <p className="text-xs font-medium uppercase text-on-surface-variant/60">{label}</p>
        <p className="mt-1 text-sm text-on-surface">{value || '—'}</p>
      </div>
    </div>
  );
}

function PatientSkeleton() {
  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg border border-outline-variant bg-surface-container"
          />
        ))}
      </div>
    </div>
  );
}

function formatSex(sex: string | undefined): string {
  const map: Record<string, string> = {
    MALE: 'Masculino',
    FEMALE: 'Femenino',
    OTHER: 'Otro',
    UNKNOWN: 'Desconocido',
  };
  return sex ? (map[sex] ?? sex) : '—';
}

function formatBloodType(bt: string | undefined | null): string {
  if (!bt) return '—';
  const map: Record<string, string> = {
    A_POS: 'A+',
    A_NEG: 'A-',
    B_POS: 'B+',
    B_NEG: 'B-',
    AB_POS: 'AB+',
    AB_NEG: 'AB-',
    O_POS: 'O+',
    O_NEG: 'O-',
    UNKNOWN: 'Desconocido',
  };
  return map[bt] ?? bt;
}

function formatAddress(addr: unknown): string {
  if (!addr || typeof addr !== 'object') return '—';
  const a = addr as Record<string, unknown>;
  const parts = [a.street, a.city, a.postalCode, a.country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '—';
}

function formatEmergencyContact(ec: unknown): string {
  if (!ec || typeof ec !== 'object') return '—';
  const e = ec as Record<string, unknown>;
  return [e.name, e.phone, e.relationship].filter(Boolean).join(' · ') || '—';
}