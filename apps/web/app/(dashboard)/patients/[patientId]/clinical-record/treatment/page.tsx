// apps/web/app/(dashboard)/patients/[patientId]/clinical-record/treatment/page.tsx
// Category: Treatment (Tratamiento) — spec §7.
// Unified view: surgeries, medication, plan, follow-up with originating events.
// Past events are immutable; corrections appear as auditable updates.

'use client';

import { useParams } from 'next/navigation';
import { useClinicalRecord } from '@/hooks/useClinicalRecord';

interface TreatmentItem {
  id: string;
  type: 'surgery' | 'medication' | 'plan' | 'follow-up';
  title: string;
  description?: string;
  status: string;
  originatingEvent?: { type: string; id: string; date: string };
  updatedAt?: string;
  isImmutable: boolean;
}

const TYPE_LABELS: Record<string, { label: string; className: string }> = {
  surgery: { label: 'Cirugía', className: 'bg-violet-500/15 text-violet-400 border-violet-500/20' },
  medication: { label: 'Medicación', className: 'bg-aqua-500/15 text-aqua-400 border-aqua-500/20' },
  plan: { label: 'Plan', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  'follow-up': { label: 'Seguimiento', className: 'bg-sky-500/15 text-sky-400 border-sky-500/20' },
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  COMPLETED: 'Completado',
  SCHEDULED: 'Programado',
  CANCELLED: 'Cancelado',
  SUSPENDED: 'Suspendido',
};

export default function TreatmentPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { data, isLoading } = useClinicalRecord(patientId, 'treatment');

  // Treatment is a projection — data comes from the API's treatment category.
  // For now, show the projection structure; the API will populate it.
  const items = (data?.data ?? []) as TreatmentItem[];

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-on-surface">Tratamiento</h2>
        <p className="text-sm text-on-surface-variant">
          Vista unificada de cirugías, medicación, plan y seguimiento.
          Los eventos pasados son inmutables; las correcciones se registran como actualizaciones auditables.
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border border-outline-variant bg-surface-low" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {/* Active treatments */}
          <TreatmentGroup
            title="Tratamiento activo"
            items={items.filter((i) => i.status === 'ACTIVE' || i.status === 'SCHEDULED')}
          />
          {/* Completed/past */}
          <TreatmentGroup
            title="Historial"
            items={items.filter((i) => i.status === 'COMPLETED' || i.status === 'CANCELLED' || i.status === 'SUSPENDED')}
          />
        </div>
      )}
    </div>
  );
}

function TreatmentGroup({ title, items }: { title: string; items: TreatmentItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium text-on-surface-variant">{title}</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <TreatmentCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

function TreatmentCard({ item }: { item: TreatmentItem }) {
  const typeConfig = TYPE_LABELS[item.type] ?? TYPE_LABELS.plan;

  return (
    <div
      className={`rounded-lg border border-outline-variant bg-surface-lowest p-4 ${
        item.isImmutable ? 'opacity-75' : ''
      }`}
      data-testid={`treatment-item-${item.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${typeConfig.className}`}>
              {typeConfig.label}
            </span>
            <span className="text-xs text-on-surface-variant/60">
              {STATUS_LABELS[item.status] ?? item.status}
            </span>
            {item.isImmutable && (
              <span className="rounded-md bg-surface-low px-1.5 py-0.5 text-xs text-on-surface-variant/60">
                Inmutable
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-on-surface">{item.title}</p>
          {item.description && (
            <p className="mt-1 text-sm text-on-surface-variant">{item.description}</p>
          )}
        </div>
      </div>

      {/* Originating event */}
      {item.originatingEvent && (
        <div className="mt-3 flex items-center gap-2 text-xs text-on-surface-variant/60">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span>
            Origen: {item.originatingEvent.type}
            {item.originatingEvent.date
              ? ` · ${new Date(item.originatingEvent.date).toLocaleDateString('es-ES')}`
              : ''}
          </span>
        </div>
      )}

      {item.updatedAt && (
        <div className="mt-1 text-xs text-on-surface-variant/60">
          Última actualización: {new Date(item.updatedAt).toLocaleDateString('es-ES')}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-outline-variant py-12 text-center">
      <p className="text-sm text-on-surface-variant">No hay tratamientos registrados.</p>
      <p className="mt-1 text-xs text-on-surface-variant/60">
        Los tratamientos se generan automáticamente desde cirugías, consultas y prescripciones.
      </p>
    </div>
  );
}
