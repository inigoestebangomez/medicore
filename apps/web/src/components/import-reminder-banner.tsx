'use client';

// apps/web/src/components/import-reminder-banner.tsx
// Spec §5 — non-intrusive dashboard banner shown when daysSinceLastImport >=
// reminderDays. Computed on-demand from GET /v1/imports/reminder. Disappears
// automatically after the physician imports (the query invalidates on import
// mutations). Does not block any functionality.

import { useImportReminder } from '@/hooks/useImports';
import Link from 'next/link';

export function ImportReminderBanner() {
  const { data, isLoading, isError } = useImportReminder();

  if (isLoading || isError || !data) return null;
  if (!data.showBanner || data.disabled) return null;

  const daysLabel =
    data.daysSinceLastImport === null
      ? 'aún no has importado pacientes'
      : `han pasado ${data.daysSinceLastImport} días desde tu última importación`;

  return (
    <div className="border-b border-outline-variant bg-clinical-warning/10 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-sm text-on-surface">
          <span aria-hidden>📥</span>
          <span>
            <strong className="font-semibold">{daysLabel}</strong>. Importa los pacientes de las
            últimas semanas para mantener tu base de datos actualizada.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/imports" className="btn-primary">
            Importar ahora
          </Link>
          <Link href="/settings" className="btn-ghost">
            Recordarme luego
          </Link>
        </div>
      </div>
    </div>
  );
}
