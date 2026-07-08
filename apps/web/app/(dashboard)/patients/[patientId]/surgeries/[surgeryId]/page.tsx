'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSurgery } from '@/hooks/useSurgeries';
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

function formatDate(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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

export default function SurgeryDetailPage() {
  const params = useParams<{ patientId: string; surgeryId: string }>();
  const { patientId, surgeryId } = params;
  const { data: surgery, isLoading, error } = useSurgery(patientId, surgeryId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary" />
      </div>
    );
  }

  if (error || !surgery) {
    return (
      <div className="container mx-auto max-w-3xl space-y-4 py-6">
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error?.message || 'Surgery not found'}
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
            {surgery.procedureType}
          </h2>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[surgery.status]}`}
          >
            {STATUS_LABEL[surgery.status]}
          </span>
        </div>

        <p className="mt-1 text-xs text-gray-400">
          {formatDate(surgery.date) ?? surgery.date}
        </p>

        <dl className="mt-6 space-y-4">
          <Field label="Procedure Type">{surgery.procedureType}</Field>

          <Field label="ASA Classification">
            {surgery.asa ? (
              <span>{surgery.asa.replace('_', '-')}</span>
            ) : (
              <Empty />
            )}
          </Field>

          <Field label="Anesthesia Type">
            {surgery.anesthesiaType ? (
              surgery.anesthesiaType
            ) : (
              <Empty />
            )}
          </Field>

          <Field label="Duration">
            {surgery.duration ? (
              <span>{surgery.duration} minutes</span>
            ) : (
              <Empty />
            )}
          </Field>

          <Field label="Findings">
            {surgery.findings ? (
              <p className="whitespace-pre-wrap">{surgery.findings}</p>
            ) : (
              <Empty />
            )}
          </Field>

          <Field label="Complications">
            {surgery.complications ? (
              <p className="whitespace-pre-wrap">{surgery.complications}</p>
            ) : (
              <Empty>None recorded</Empty>
            )}
          </Field>

          <Field label="Post-Op Notes">
            {surgery.postOpNotes ? (
              <p className="whitespace-pre-wrap">{surgery.postOpNotes}</p>
            ) : (
              <Empty />
            )}
          </Field>
        </dl>
      </div>
    </div>
  );
}