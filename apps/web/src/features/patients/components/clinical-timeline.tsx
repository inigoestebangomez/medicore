'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { ConsultationListItem, SurgeryResponse, ImportedClinicalEvent } from '@medicore/contracts';
import { apiFetch } from '@/lib/api-fetch';
import { useImportedClinicalEvents } from '@/hooks/useImportedClinicalEvents';

const API_BASE = '/v1/patients';

interface TimelineEvent {
  id: string;
  type: 'consultation' | 'surgery' | 'imaging';
  date: string;
  label: string;
  description: string;
  href: string;
}

interface ClinicalTimelineProps {
  patientId: string;
}

interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ImagingStudyRef {
  id: string;
  type: string;
  date: string;
  description: string | null;
}

const EVENT_ICONS: Record<TimelineEvent['type'], React.ReactNode> = {
  consultation: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  surgery: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M16 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4h-4" />
      <path d="M12 6v2" />
      <path d="M12 16v2" />
    </svg>
  ),
  imaging: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <circle cx="12" cy="12" r="1" />
      <path d="M5 12s2-6 7-6 7 6 7 6-2 6-7 6-7-6-7-6" />
    </svg>
  ),
};

const EVENT_LABELS: Record<TimelineEvent['type'], string> = {
  consultation: 'Consulta',
  surgery: 'Cirugía',
  imaging: 'Imagen',
};

const EVENT_COLORS: Record<TimelineEvent['type'], string> = {
  consultation: 'bg-blue-100 text-blue-700',
  surgery: 'bg-green-100 text-green-700',
  imaging: 'bg-purple-100 text-purple-700',
};

const DOT_COLORS: Record<TimelineEvent['type'], string> = {
  consultation: 'bg-blue-500',
  surgery: 'bg-green-500',
  imaging: 'bg-purple-500',
};

const PAGE_SIZE = 20;
const IMPORTED_STANDARD_FIELD_ORDER = [
  'nhc', 'patientName', 'birthDate', 'birthDateEstimated', 'birthDateReferenceYear', 'age', 'sex', 'admissionDate', 'diagnosis',
  'phone', 'email', 'idDocument', 'idDocType', 'address', 'bloodType',
  'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship', 'notes',
  'consultationDate', 'consultationType', 'chiefComplaint', 'currentIllness', 'physicalExam', 'assessment',
  'diagnosisCodes', 'plan', 'followUpDate', 'followUpNotes', 'surgeryDate', 'procedure', 'surgeryStatus',
  'asa', 'anesthesiaType', 'surgeryDurationMinutes', 'technique', 'findings', 'complications', 'postOpNotes',
  'outcome', 'testType', 'requestDate', 'completionDate', 'hospitalStayDays',
];
const IMPORTED_FIELD_LABELS: Record<string, string> = {
  nhc: 'NHC',
  patientName: 'Nombre del paciente',
  birthDate: 'Fecha de nacimiento',
  age: 'Edad en la importación',
  sex: 'Sexo',
  phone: 'Teléfono',
  email: 'Email',
  idDocument: 'Documento de identidad',
  idDocType: 'Tipo de documento',
  address: 'Dirección',
  bloodType: 'Grupo sanguíneo',
  emergencyContactName: 'Contacto de emergencia',
  emergencyContactPhone: 'Teléfono de emergencia',
  emergencyContactRelationship: 'Relación del contacto',
  notes: 'Notas',
  ageAtImport: 'Edad en la importación',
  birthDateEstimated: 'Fecha de nacimiento estimada',
  birthDateReferenceYear: 'Año de referencia de la edad',
  admissionDate: 'Fecha de ingreso',
  consultationDate: 'Fecha de consulta',
  diagnosis: 'Diagnóstico',
  diagnosisCodes: 'Códigos diagnósticos',
  consultationType: 'Tipo de consulta',
  chiefComplaint: 'Motivo de consulta',
  currentIllness: 'Enfermedad actual',
  physicalExam: 'Exploración física',
  assessment: 'Valoración',
  plan: 'Plan',
  followUpDate: 'Fecha de seguimiento',
  followUpNotes: 'Notas de seguimiento',
  surgeryDate: 'Fecha de cirugía',
  procedure: 'Procedimiento',
  surgeryStatus: 'Estado de cirugía',
  asa: 'Clasificación ASA',
  anesthesiaType: 'Tipo de anestesia',
  surgeryDurationMinutes: 'Tiempo quirúrgico (minutos)',
  technique: 'Técnica quirúrgica',
  findings: 'Hallazgos',
  complications: 'Complicaciones',
  postOpNotes: 'Notas postoperatorias',
  outcome: 'Resultado',
  testType: 'Tipo de estudio',
  requestDate: 'Fecha de solicitud',
  completionDate: 'Fecha de realización',
  hospitalStayDays: 'Tiempo de hospitalización (días)',
};

function displayValue(value: string | number | boolean | null): string {
  return value === null || value === '' ? '—' : String(value);
}

function orderedImportedFields(item: ImportedClinicalEvent): Array<[string, string | number | boolean | null]> {
  const standard = Object.entries(item.standardFields).sort(
    ([a], [b]) => IMPORTED_STANDARD_FIELD_ORDER.indexOf(a) - IMPORTED_STANDARD_FIELD_ORDER.indexOf(b),
  );
  const custom = Object.entries(item.customFields).sort(([a], [b]) => a.localeCompare(b, 'es'));
  return [...standard, ...custom];
}

function compareImportedItems(a: ImportedClinicalEvent, b: ImportedClinicalEvent): number {
  const aTime = a.date ? new Date(a.date).getTime() : Number.NEGATIVE_INFINITY;
  const bTime = b.date ? new Date(b.date).getTime() : Number.NEGATIVE_INFINITY;
  return bTime - aTime || a.id.localeCompare(b.id);
}

const CONSULTATION_TYPE_LABELS: Record<string, string> = {
  FIRST_VISIT: 'Primera visita',
  FOLLOW_UP: 'Seguimiento',
  URGENCY: 'Urgencia',
  POST_OP: 'Postoperatoria',
  TELECONSULTATION: 'Teleconsulta',
};

const SURGERY_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Programada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  POSTPONED: 'Aplazada',
};

export function ImportedHistorySection({
  items,
  hasMore,
  onLoadMore,
  loading = false,
}: {
  items: ImportedClinicalEvent[];
  hasMore: boolean;
  onLoadMore: () => void;
  loading?: boolean;
}) {
  if (items.length === 0 && !loading) return null;
  const orderedItems = [...items].sort(compareImportedItems);
  return (
    <section aria-labelledby="imported-history-heading" className="mt-8 border-t border-outline-variant pt-6">
      <h3 id="imported-history-heading" className="mb-3 text-sm font-semibold text-on-surface">Historial importado</h3>
      <p className="mb-4 text-xs text-on-surface-variant">
        Estos datos conservan la procedencia de la importación. Cuando contienen información clínica explícita,
        también se generan consultas o cirugías nativas; el resto permanece aquí como historial importado.
      </p>
      {loading && items.length === 0 ? <p className="text-sm text-on-surface-variant">Cargando historial importado…</p> : null}
      <div className="space-y-3">
        {orderedItems.map((item) => {
          const fields = orderedImportedFields(item);
          const provenance = item.rowIndices.length > 1
            ? `Filas ${item.rowIndices[0]}–${item.rowIndices[item.rowIndices.length - 1]} (bloque agrupado)`
            : item.rowIndex === null ? 'Fila de origen no disponible' : `Fila ${item.rowIndex}`;
          return (
            <article key={item.id} className="rounded-lg border border-outline-variant bg-surface-lowest p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Dato importado</span>
                <time className="text-xs text-on-surface-variant/60">{item.date ? new Date(item.date).toLocaleDateString('es-ES') : 'Sin fecha'}</time>
              </div>
              <p className="mt-2 text-xs font-medium text-on-surface-variant">{provenance}{item.batchId ? ` · Lote ${item.batchId}` : ''}</p>
              {item.rowGranularity === 'merged-block' ? (
                <p className="mt-1 text-xs text-on-surface-variant">Se muestran los valores conservados en este bloque agrupado.</p>
              ) : null}
              <dl className="mt-2 space-y-1 text-sm">
                {fields.map(([key, value]) => {
                  const text = displayValue(value);
                  return (
                    <div key={key}>
                      <dt className="inline font-medium text-on-surface-variant">{IMPORTED_FIELD_LABELS[key] ?? key}: </dt>
                      <dd className="inline whitespace-pre-wrap break-words text-on-surface">{text.length > 280 ? `${text.slice(0, 280)}…` : text}</dd>
                    </div>
                  );
                })}
              </dl>
            </article>
          );
        })}
      </div>
      {hasMore ? (
        <button type="button" onClick={onLoadMore} disabled={loading} className="mt-4 text-sm font-medium text-primary underline disabled:opacity-50">
          Cargar más historial importado
        </button>
      ) : null}
    </section>
  );
}

export function ClinicalTimeline({ patientId }: ClinicalTimelineProps) {
  const importedQuery = useImportedClinicalEvents(patientId);
  const consultationsQuery = useQuery<ListResponse<ConsultationListItem>>({
    queryKey: ['consultations', patientId, 'list'],
    queryFn: async () => {
      const res = await apiFetch<{ data: ListResponse<ConsultationListItem> } | ListResponse<ConsultationListItem>>(
        `${API_BASE}/${patientId}/consultations?page=1&pageSize=${PAGE_SIZE}&sortBy=date&sortOrder=desc`,
      );
      return 'data' in res ? res.data : res;
    },
    enabled: !!patientId,
  });

  const surgeriesQuery = useQuery<ListResponse<SurgeryResponse>>({
    queryKey: ['surgeries', patientId, 'list'],
    queryFn: async () => {
      const res = await apiFetch<{ data: ListResponse<SurgeryResponse> } | ListResponse<SurgeryResponse>>(
        `${API_BASE}/${patientId}/surgeries?page=1&pageSize=${PAGE_SIZE}&sortBy=date&sortOrder=desc`,
      );
      return 'data' in res ? res.data : res;
    },
    enabled: !!patientId,
  });

  const imagingQuery = useQuery<ListResponse<ImagingStudyRef>>({
    queryKey: ['imaging', patientId, 'list'],
    queryFn: async () => {
      const res = await apiFetch<{ data: ListResponse<ImagingStudyRef> } | ListResponse<ImagingStudyRef>>(
        `${API_BASE}/${patientId}/imaging?page=1&pageSize=${PAGE_SIZE}&sortBy=date&sortOrder=desc`,
      );
      return 'data' in res ? res.data : res;
    },
    enabled: !!patientId,
  });

  const isLoading = consultationsQuery.isLoading || surgeriesQuery.isLoading || imagingQuery.isLoading;
  const isError = consultationsQuery.isError || surgeriesQuery.isError || imagingQuery.isError;
  const error =
    consultationsQuery.error?.message ??
    surgeriesQuery.error?.message ??
    imagingQuery.error?.message ??
    'No se pudo cargar la cronología';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-outline border-t-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  const events: TimelineEvent[] = [
    ...(consultationsQuery.data?.items ?? []).map(
      (item): TimelineEvent => ({
        id: item.id,
        type: 'consultation',
        date: item.date,
        label: CONSULTATION_TYPE_LABELS[item.type] ?? item.type.replace(/_/g, ' '),
        description: item.chiefComplaint,
        href: `/patients/${patientId}/consultations/${item.id}`,
      }),
    ),
    ...(surgeriesQuery.data?.items ?? []).map(
      (item): TimelineEvent => ({
        id: item.id,
        type: 'surgery',
        date: item.date,
        label: SURGERY_STATUS_LABELS[item.status] ?? item.status,
        description: item.procedureType,
        href: `/patients/${patientId}/surgeries/${item.id}`,
      }),
    ),
    ...(imagingQuery.data?.items ?? []).map(
      (item): TimelineEvent => ({
        id: item.id,
        type: 'imaging',
        date: item.date,
        label: item.type.replace(/_/g, ' '),
        description: item.description ?? 'Sin descripción',
        href: `/patients/${patientId}/imaging/${item.id}`,
      }),
    ),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (events.length === 0 && importedQuery.items.length === 0 && !importedQuery.isLoading) {
    return <div className="py-8 text-center text-sm text-on-surface-variant/60">Todavía no hay eventos clínicos registrados</div>;
  }

  return (
    <div className="relative space-y-0 pl-8">
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-surface-high" />

      {events.map((event) => {
        const IconNode = EVENT_ICONS[event.type];
        const dateFormatted = new Date(event.date).toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });

        return (
          <Link
            key={`${event.type}-${event.id}`}
            href={event.href}
            className="relative block pb-5 group"
          >
            <span
              className={`absolute left-[-20px] top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white ${DOT_COLORS[event.type]}`}
            >
              {IconNode}
            </span>

            <div className="rounded-lg border border-outline-variant bg-surface-lowest p-3 shadow-card transition-shadow group-hover:shadow-dropdown">
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${EVENT_COLORS[event.type]}`}
                >
                  {EVENT_LABELS[event.type]}
                </span>
                <span className="text-xs text-on-surface-variant/60">{dateFormatted}</span>
              </div>
              {event.label && (
                <p className="mt-1 text-xs text-on-surface-variant">{event.label}</p>
              )}
              <p className="mt-1 text-sm font-medium text-on-surface line-clamp-1">
                {event.description}
              </p>
            </div>
          </Link>
        );
      })}
      <ImportedHistorySection
        items={importedQuery.items}
        hasMore={Boolean(importedQuery.hasNextPage)}
        loading={importedQuery.isLoading || importedQuery.isFetchingNextPage}
        onLoadMore={() => void importedQuery.loadMore()}
      />
    </div>
  );
}
