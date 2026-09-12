// apps/web/app/(dashboard)/patients/[patientId]/clinical-record/patient-data/page.tsx
// Category: Patient Data — demographics, age semantics (spec §1).

'use client';

import { useParams } from 'next/navigation';
import { useClinicalRecord } from '@/hooks/useClinicalRecord';

export default function PatientDataPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { data, isLoading } = useClinicalRecord(patientId, 'patient-data');

  if (isLoading) {
    return <CategorySkeleton />;
  }

  const patientData = data?.data?.[0] as Record<string, unknown> | undefined;
  if (!patientData) {
    return (
      <p className="py-6 text-sm text-on-surface-variant">
        Paciente no encontrado
      </p>
    );
  }

  const ageInfo = patientData.ageInfo as
    | { age: number; source: 'birthDate' | 'referenceDate'; referenceDate?: string }
    | undefined;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-on-surface">
          Datos del paciente
        </h2>
        <p className="text-sm text-on-surface-variant">
          Información demográfica y datos de identificación.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <DataField label="NHC" value={String(patientData.nhc ?? '—')} />
        <DataField
          label="Nombre"
          value={`${patientData.firstName ?? ''} ${patientData.lastName ?? ''}`.trim() || '—'}
        />
        <DataField
          label="Fecha de nacimiento"
          value={
            patientData.birthDate
              ? new Date(patientData.birthDate as string).toLocaleDateString('es-ES')
              : 'No disponible'
          }
        />
        <DataField
          label="Edad"
          value={
            ageInfo
              ? `${ageInfo.age} años${ageInfo.source === 'referenceDate' ? ' (estimada)' : ''}`
              : '—'
          }
        />
        {ageInfo?.source === 'referenceDate' && ageInfo.referenceDate && (
          <DataField
            label="Referencia de edad"
            value={ageInfo.referenceDate}
            span={2}
          />
        )}
        <DataField label="Sexo" value={formatSex(patientData.sex as string)} />
        <DataField
          label="Teléfono"
          value={(patientData.phone as string) ?? '—'}
        />
        <DataField
          label="Email"
          value={(patientData.email as string) ?? '—'}
        />
        <DataField
          label="Grupo sanguíneo"
          value={formatBloodType(patientData.bloodType as string)}
        />
      </div>

      {ageInfo?.source === 'referenceDate' && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-xs font-medium text-amber-400">
            Edad estimada
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">
            La fecha de nacimiento no está disponible. La edad se calcula a
            partir de la fecha de referencia proporcionada.
          </p>
        </div>
      )}
    </div>
  );
}

function DataField({
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
        <p className="text-xs font-medium uppercase text-on-surface-variant/60">
          {label}
        </p>
        <p className="mt-1 text-sm text-on-surface">{value || '—'}</p>
      </div>
    </div>
  );
}

function CategorySkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-48 animate-pulse rounded bg-surface-low" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg border border-outline-variant bg-surface-low"
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
