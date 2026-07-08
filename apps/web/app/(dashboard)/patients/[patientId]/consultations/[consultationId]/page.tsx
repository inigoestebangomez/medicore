'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useConsultation } from '@/hooks/useConsultations';
import type { ConsultationType, DiagnosisCode } from '@medicore/contracts';

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

const DIAG_TYPE_COLOR: Record<DiagnosisCode['type'], string> = {
  primary: 'bg-blue-50 text-blue-700 border-blue-200',
  secondary: 'bg-gray-50 text-gray-700 border-gray-200',
  differential: 'bg-amber-50 text-amber-700 border-amber-200',
};

function formatDate(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1 border-t border-gray-100 pt-4 first:border-0 first:pt-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </dt>
      <dd className="text-sm text-gray-700">{children}</dd>
    </div>
  );
}

function Empty({ children = 'Not recorded' }: { children?: React.ReactNode }) {
  return <span className="text-gray-400 italic">{children}</span>;
}

export default function ConsultationDetailPage() {
  const params = useParams<{ patientId: string; consultationId: string }>();
  const { patientId, consultationId } = params;
  const { data: consultation, isLoading, error } = useConsultation(
    patientId,
    consultationId,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary" />
      </div>
    );
  }

  if (error || !consultation) {
    return (
      <div className="container mx-auto max-w-3xl space-y-4 py-6">
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error?.message || 'Consultation not found'}
        </div>
        <Link
          href={`/patients/${patientId}`}
          className="inline-block text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to patient
        </Link>
      </div>
    );
  }

  const physicalExam = consultation.physicalExam;
  const physicalEntries =
    physicalExam && typeof physicalExam === 'object'
      ? Object.entries(physicalExam as Record<string, unknown>)
      : [];

  return (
    <div className="container mx-auto max-w-3xl space-y-6 py-6">
      <Link
        href={`/patients/${patientId}`}
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        &larr; Back to patient
      </Link>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-semibold text-gray-900">
            {formatDate(consultation.date) ?? consultation.date}
          </h2>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_BADGE[consultation.type]}`}
          >
            {TYPE_LABEL[consultation.type]}
          </span>
        </div>

        {consultation.physicianName && (
          <p className="mt-1 text-xs text-gray-400">
            Physician: {consultation.physicianName}
          </p>
        )}

        <dl className="mt-6 space-y-4">
          <Field label="Chief Complaint">
            {consultation.chiefComplaint}
          </Field>

          <Field label="Current Illness">
            {consultation.currentIllness ? (
              <p className="whitespace-pre-wrap">{consultation.currentIllness}</p>
            ) : (
              <Empty />
            )}
          </Field>

          <Field label="Physical Exam">
            {physicalEntries.length === 0 ? (
              <Empty />
            ) : (
              <ul className="space-y-1">
                {physicalEntries.map(([key, value]) => (
                  <li key={key} className="flex gap-2">
                    <span className="font-medium text-gray-600">{key}:</span>
                    <span>
                      {typeof value === 'object'
                        ? JSON.stringify(value)
                        : String(value)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Field>

          <Field label="Assessment">
            {consultation.assessment ? (
              <p className="whitespace-pre-wrap">{consultation.assessment}</p>
            ) : (
              <Empty />
            )}
          </Field>

          <Field label="Diagnosis Codes">
            {!consultation.diagnosisCodes ||
            consultation.diagnosisCodes.length === 0 ? (
              <Empty />
            ) : (
              <div className="flex flex-wrap gap-2">
                {consultation.diagnosisCodes.map((code, idx) => (
                  <span
                    key={`${code.system}-${code.code}-${idx}`}
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${DIAG_TYPE_COLOR[code.type]}`}
                    title={`${code.type}${code.notes ? ` — ${code.notes}` : ''}`}
                  >
                    <span className="font-semibold">{code.code}</span>
                    <span className="mx-1 text-gray-300">·</span>
                    <span>{code.description}</span>
                  </span>
                ))}
              </div>
            )}
          </Field>

          <Field label="Plan">
            {consultation.plan ? (
              <p className="whitespace-pre-wrap">{consultation.plan}</p>
            ) : (
              <Empty />
            )}
          </Field>

          <Field label="Follow-up Date">
            {consultation.followUpDate ? (
              formatDate(consultation.followUpDate)
            ) : (
              <Empty>Not scheduled</Empty>
            )}
          </Field>
        </dl>
      </div>
    </div>
  );
}