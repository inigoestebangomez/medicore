'use client';

// apps/web/src/features/research-form/components/VariableLibrary/TemplateList.tsx
// TemplateList (REQ-FB-002): paginated list of org-level reusable templates.

import type { VariableTemplateResponse } from '@medicore/contracts';
import { useVariableTemplates } from '@/features/research-form/api/useResearchForm';

export function TemplateList() {
  const { data, isLoading } = useVariableTemplates(1, 100);
  if (isLoading) return <p className="text-sm text-on-surface-variant">Cargando plantillas…</p>;
  const items = data?.items ?? [];
  if (items.length === 0) return <p className="text-sm text-on-surface-variant">Aún no hay plantillas en la biblioteca.</p>;
  return (
    <ul className="space-y-2">
      {items.map((t: VariableTemplateResponse) => (
        <li key={t.id} className="rounded border border-outline bg-surface p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-on-surface">{t.name}</span>
            <span className="rounded-full bg-surface-low px-2 py-0.5 text-[11px] text-on-surface-variant">{t.type}</span>
          </div>
          {t.description && <p className="mt-1 text-xs text-on-surface-variant">{t.description}</p>}
          {t.unit && <p className="text-xs text-on-surface-variant">Unidad: {t.unit}</p>}
        </li>
      ))}
    </ul>
  );
}

export default TemplateList;