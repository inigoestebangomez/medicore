type ClinicalStatus =
  | 'DRAFT'
  | 'REVIEWED'
  | 'SIGNED'
  | 'ACTIVE'
  | 'SCHEDULED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'SURGERY'
  | 'EMERGENCY'
  | 'FOLLOW-UP';

const STATUS_LABELS: Record<ClinicalStatus, string> = {
  DRAFT: 'Borrador',
  REVIEWED: 'Revisado',
  SIGNED: 'Firmado',
  ACTIVE: 'Activo',
  SCHEDULED: 'Programado',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
  SURGERY: 'Cirugía',
  EMERGENCY: 'Urgencia',
  'FOLLOW-UP': 'Seguimiento',
};

const variants: Record<ClinicalStatus, string> = {
  DRAFT: 'bg-surface-low text-on-surface-variant border-outline-variant',
  REVIEWED: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  SIGNED: 'bg-aqua-500/15 text-aqua-400 border-aqua-500/20',
  ACTIVE: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  SCHEDULED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  COMPLETED: 'bg-aqua-500/15 text-aqua-400 border-aqua-500/20',
  CANCELLED: 'bg-surface-low text-on-surface-variant/60 border-outline-variant',
  SURGERY: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
  EMERGENCY: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
  'FOLLOW-UP': 'bg-sky-500/15 text-sky-400 border-sky-500/20',
};

interface StatusBadgeProps {
  status: ClinicalStatus;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full ${variants[status]} ${className}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export type { ClinicalStatus };
