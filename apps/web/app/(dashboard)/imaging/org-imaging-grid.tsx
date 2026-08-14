'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOrgImagingStudies, usePresignedUrl } from '@/hooks/useImagingStudies';
import type { ImagingStudyType, OrgImagingStudyListItem } from '@medicore/contracts';
import { normalizeImagingFile } from '@/components/imaging/imaging-file';

const TYPE_OPTIONS: (ImagingStudyType | '')[] = [
  '',
  'CT_SCAN',
  'MRI',
  'XRAY',
  'ENDOSCOPY',
  'ULTRASOUND',
  'NASOFIBROSCOPY',
  'LARYNGOSCOPY',
  'AUDIOGRAM',
  'TYMPANOGRAM',
  'ABR',
  'VIDEONYSTAGMOGRAPHY',
  'VHIT',
  'OTHER',
];

const TYPE_BADGE: Record<string, string> = {
  CT_SCAN: 'bg-indigo-100 text-indigo-800',
  MRI: 'bg-purple-100 text-purple-800',
  XRAY: 'bg-slate-100 text-slate-800',
  ENDOSCOPY: 'bg-emerald-100 text-emerald-800',
  ULTRASOUND: 'bg-cyan-100 text-cyan-800',
  NASOFIBROSCOPY: 'bg-teal-100 text-teal-800',
  LARYNGOSCOPY: 'bg-teal-100 text-teal-800',
  AUDIOGRAM: 'bg-amber-100 text-amber-800',
  TYMPANOGRAM: 'bg-amber-100 text-amber-800',
  ABR: 'bg-amber-100 text-amber-800',
  VIDEONYSTAGMOGRAPHY: 'bg-orange-100 text-orange-800',
  VHIT: 'bg-orange-100 text-orange-800',
  OTHER: 'bg-surface-container text-on-surface-variant',
};

function formatEnum(key: string): string {
  return key
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isImageThumbnail(mimeType: string | undefined): boolean {
  return mimeType?.startsWith('image/') ?? false;
}

function StudyThumbnail({ study }: { study: OrgImagingStudyListItem }) {
  const firstImage = study.files
    .map(normalizeImagingFile)
    .find((f) => isImageThumbnail(f.mimeType));
  const { data, error, refetch } = usePresignedUrl(
    study.patientId,
    study.id,
    firstImage?.key ?? '',
  );

  if (!firstImage) {
    return (
      <div className="flex h-32 w-full items-center justify-center rounded bg-surface-container text-on-surface-variant/60">
        <span className="text-xs">Sin vista previa</span>
      </div>
    );
  }

  if (error) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          refetch();
        }}
        className="flex h-32 w-full items-center justify-center rounded bg-red-50 text-xs text-red-600"
      >
        Reintentar vista previa
      </button>
    );
  }

  const imageUrl = firstImage.url ?? data?.url;

  if (!imageUrl) {
    return (
      <div className="flex h-32 w-full items-center justify-center rounded bg-surface-container text-xs text-on-surface-variant">
        {error ? 'No se pudo cargar la vista previa' : 'Vista previa no disponible'}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt={firstImage.originalName}
      className="h-32 w-full rounded object-cover"
    />
  );
}

export function OrgImagingGrid() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [type, setType] = useState<ImagingStudyType | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isLoading, error } = useOrgImagingStudies({
    page,
    pageSize: 24,
    type,
    from: from || undefined,
    to: to || undefined,
  });

  const totalPages = data ? Math.max(1, data.totalPages) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-on-surface">Imágenes</h2>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="text-sm text-on-surface-variant">
          Tipo
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as ImagingStudyType | '');
              setPage(1);
            }}
            className="ml-2 rounded border border-outline px-2 py-1 text-sm"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t === '' ? 'Todos' : formatEnum(t)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-on-surface-variant">
          Desde
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="ml-2 rounded border border-outline px-2 py-1 text-sm"
          />
        </label>

        <label className="text-sm text-on-surface-variant">
          Hasta
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="ml-2 rounded border border-outline px-2 py-1 text-sm"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {TYPE_OPTIONS.filter((t) => t !== '').map((t) => (
          <button
            key={t}
            onClick={() => {
              setType(type === t ? '' : t);
              setPage(1);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              type === t ? TYPE_BADGE[t] : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            {formatEnum(t)}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={`sk-${i}`} className="h-48 animate-pulse rounded-lg border border-outline-variant bg-surface-container" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-600">
          Error al cargar estudios de imagen.{' '}
          <button className="underline" onClick={() => window.location.reload()}>Reintentar</button>
        </div>
      )}

      {data && data.items.length === 0 && !error && (
        <div className="rounded-lg border border-outline-variant bg-surface-lowest p-12 text-center">
          <p className="text-on-surface-variant">No hay estudios de imagen</p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {data.items.map((s) => (
            <button
              key={s.id}
              onClick={() => router.push(`/patients/${s.patientId}/imaging/${s.id}`)}
              className="flex flex-col overflow-hidden rounded-lg border border-outline-variant bg-surface-lowest text-left shadow-sm transition hover:shadow-md"
            >
              <StudyThumbnail study={s} />
              <div className="flex flex-1 flex-col gap-1 p-3">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[s.type] ?? TYPE_BADGE.OTHER}`}>
                    {formatEnum(s.type)}
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    {new Date(s.date).toLocaleDateString('es-ES')}
                  </span>
                </div>
                <span className="text-sm font-medium text-on-surface">
                  {s.patientFirstName} {s.patientLastName}
                </span>
                <span className="line-clamp-2 text-xs text-on-surface-variant">
                  {s.description ?? s.findings ?? 'Sin descripción'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-on-surface-variant">
        <span>{data ? `${data.total} estudios` : '—'}</span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded border border-outline px-3 py-1 disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="px-2 py-1">Página {page} de {totalPages}</span>
          <button
            onClick={() => setPage((p) => (p < totalPages ? p + 1 : p))}
            disabled={page >= totalPages}
            className="rounded border border-outline px-3 py-1 disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
