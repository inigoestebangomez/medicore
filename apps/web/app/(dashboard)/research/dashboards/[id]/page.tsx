'use client';

// apps/web/app/(dashboard)/research/dashboards/[id]/page.tsx
// Dashboard view (spec §4). Loads the dashboard by id and renders the
// DashboardBuilder (drag-drop widget canvas). A simple list-less index is not
// provided here — the research landing surfaces dashboard links. Feature-flag
// aware (RESEARCH_V2_DASHBOARDS): when disabled, shows an upgrade notice.

import { useDashboard } from '@/hooks/useResearchV2';
import { DashboardBuilder } from '@/components/research/DashboardBuilder';

const FLAG = process.env.NEXT_PUBLIC_RESEARCH_V2_DASHBOARDS; // '' off, '1' on

export default function DashboardPage({ params }: { params: { id: string } }) {
  const { data, isLoading, isError } = useDashboard(params.id);

  if (FLAG === '') {
    return (
      <div className="container mx-auto py-10 text-center text-sm text-on-surface-variant">
        Los dashboards están en beta (feature flag RESEARCH_V2_DASHBOARDS desactivado).
      </div>
    );
  }

  if (isLoading) return <div className="container mx-auto py-6 text-sm text-on-surface-variant">Cargando dashboard…</div>;
  if (isError || !data) return <div className="container mx-auto py-6 text-sm text-red-600">Dashboard no encontrado.</div>;

  return (
    <div className="container mx-auto space-y-4 py-6">
      <DashboardBuilder dashboard={data} />
    </div>
  );
}