'use client';

// apps/web/src/components/imaging/imaging-study-list.tsx
// List imaging studies for a patient with filters and pagination

import React, { useState } from 'react';
import {
  useImagingStudies,
  useDeleteImagingStudy,
} from '@/hooks/useImagingStudies';
import type { ImagingStudyType } from '@medicore/contracts';

const STUDY_TYPE_LABELS: Record<string, string> = {
  CT_SCAN: 'TC',
  MRI: 'RMN',
  XRAY: 'Radiografía',
  ENDOSCOPY: 'Endoscopía',
  NASOFIBROSCOPY: 'Nasofibroscopía',
  LARYNGOSCOPY: 'Laringoscopía',
  AUDIOGRAM: 'Audiograma',
  TYMPANOGRAM: 'Timpanograma',
  ABR: 'ABR',
  VIDEONYSTAGMOGRAPHY: 'VNG',
  VHIT: 'VHIT',
  ULTRASOUND: 'Ecografía',
  OTHER: 'Otro',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

interface ImagingStudyListProps {
  patientId: string;
  onStudyClick?: (studyId: string) => void;
}

export function ImagingStudyList({ patientId, onStudyClick }: ImagingStudyListProps) {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<ImagingStudyType | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const pageSize = 10;

  const { data, isLoading, error } = useImagingStudies(patientId, {
    page,
    pageSize,
    sortBy: 'date',
    sortOrder: 'desc',
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(fromDate ? { from: new Date(fromDate).toISOString() } : {}),
    ...(toDate ? { to: new Date(toDate).toISOString() } : {}),
  });

  const deleteMutation = useDeleteImagingStudy(patientId);

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Error al cargar estudios: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label htmlFor="type-filter" className="block text-xs font-medium text-gray-600 mb-1">
            Tipo
          </label>
          <select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value as ImagingStudyType | ''); setPage(1); }}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            {Object.entries(STUDY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="from-date" className="block text-xs font-medium text-gray-600 mb-1">
            Desde
          </label>
          <input
            id="from-date"
            type="date"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div>
          <label htmlFor="to-date" className="block text-xs font-medium text-gray-600 mb-1">
            Hasta
          </label>
          <input
            id="to-date"
            type="date"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-8 text-gray-500">Cargando estudios...</div>
      )}

      {/* Empty state */}
      {!isLoading && data && data.items.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          No hay estudios de imagenología para este paciente
        </div>
      )}

      {/* Study cards */}
      {!isLoading && data && data.items.length > 0 && (
        <ul className="space-y-3">
          {data.items.map((study) => (
            <li
              key={study.id}
              onClick={() => onStudyClick?.(study.id)}
              className={`
                rounded border bg-white p-4 transition-shadow hover:shadow-md
                ${study.deletedAt ? 'border-red-200 opacity-60' : 'border-gray-200 cursor-pointer'}
              `}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                      {STUDY_TYPE_LABELS[study.type] ?? study.type}
                    </span>
                    {study.deletedAt && (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                        Eliminado
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {formatDate(study.date)}
                    </span>
                  </div>

                  {study.description && (
                    <p className="mt-1 text-sm text-gray-700 truncate">{study.description}</p>
                  )}

                  {study.findings && (
                    <p className="mt-0.5 text-xs text-gray-500 truncate">{study.findings}</p>
                  )}

                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                    <span>{study.files?.length ?? 0} archivo{(study.files?.length ?? 0) !== 1 ? 's' : ''}</span>
                    {study.surgeryId && <span>Vinculado a cirugía</span>}
                    {study.consultationId && <span>Vinculado a consulta</span>}
                  </div>
                </div>

                {!study.deletedAt && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('¿Eliminar este estudio?')) {
                        deleteMutation.mutate(study.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                    aria-label="Eliminar estudio"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
          >
            ← Anterior
          </button>
          <span className="text-sm text-gray-600">
            Pág. {data.page} de {data.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page >= data.totalPages}
            className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}