'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useImagingStudy } from '@/hooks/useImagingStudies';
import { ImagingFileList } from '@/components/imaging/imaging-file-list';

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
    <div className="space-y-1 border-t border-outline-variant pt-4 first:border-0 first:pt-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant/60">
        {label}
      </dt>
      <dd className="text-sm text-on-surface-variant">{children}</dd>
    </div>
  );
}

function Empty({ children = 'Not recorded' }: { children?: React.ReactNode }) {
  return <span className="text-on-surface-variant/60 italic">{children}</span>;
}

export default function ImagingStudyDetailPage() {
  const params = useParams<{ patientId: string; imagingId: string }>();
  const { patientId, imagingId } = params;
  const { data: study, isLoading, error } = useImagingStudy(
    patientId,
    imagingId,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-outline-variant border-t-primary" />
      </div>
    );
  }

  if (error || !study) {
    return (
      <div className="container mx-auto max-w-3xl space-y-4 py-6">
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error?.message || 'Imaging study not found'}
        </div>
        <Link
          href={`/patients/${patientId}`}
          className="inline-block text-sm text-on-surface-variant hover:text-on-surface-variant"
        >
          &larr; Back to patient
        </Link>
      </div>
    );
  }

  const typeLabel = study.type.replace(/_/g, ' ');

  return (
    <div className="container mx-auto max-w-3xl space-y-6 py-6">
      <Link
        href={`/patients/${patientId}`}
        className="text-sm text-on-surface-variant hover:text-on-surface-variant"
      >
        &larr; Back to patient
      </Link>

      <div className="rounded-lg border border-outline-variant bg-surface-lowest p-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-semibold text-on-surface">
            {typeLabel}
          </h2>
          <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
            Imaging Study
          </span>
        </div>

        <p className="mt-1 text-xs text-on-surface-variant/60">
          {formatDate(study.date) ?? study.date}
        </p>

        <dl className="mt-6 space-y-4">
          <Field label="Type">
            <span className="capitalize">{typeLabel.toLowerCase()}</span>
          </Field>

          <Field label="Description">
            {study.description ? (
              <p className="whitespace-pre-wrap">{study.description}</p>
            ) : (
              <Empty />
            )}
          </Field>

          <Field label="Findings">
            {study.findings ? (
              <p className="whitespace-pre-wrap">{study.findings}</p>
            ) : (
              <Empty>No findings recorded</Empty>
            )}
          </Field>

          <Field label="Files">
            <ImagingFileList patientId={patientId} studyId={imagingId} files={study.files} />
          </Field>
        </dl>
      </div>
    </div>
  );
}
