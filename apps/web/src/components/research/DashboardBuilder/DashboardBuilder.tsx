'use client';

// apps/web/src/components/research/DashboardBuilder/DashboardBuilder.tsx
// Multi-widget dashboard canvas (spec §4, design §Frontend). Widgets reference
// a ResearchQuery (AD-2) and render via WidgetRenderer. Layout uses a 12-col
// CSS grid; widgets are draggable via HTML5 DnD — dropping on another widget
// swaps their {x,y} positions and the parent persists via useUpdateLayout.
//
// react-grid-layout is not installed in this workspace; a lightweight grid +
// HTML5 swap avoids the extra dependency while satisfying the drag-drop–

import { useState, type CSSProperties } from 'react';
import type { DashboardResponse, DashboardWidget, WidgetPosition } from '@medicore/contracts';
import { useUpdateLayout } from '@/hooks/useResearchV2';
import { WidgetRenderer } from './WidgetRenderer';

export interface DashboardBuilderProps {
  dashboard: DashboardResponse;
}

/** Grid coordinates → inline style for a 12-col CSS grid with auto rows. */
function cellStyle(pos: WidgetPosition): CSSProperties {
  return {
    gridColumn: `${pos.x + 1} / span ${Math.min(pos.w, 12)}`,
    gridRow: `${pos.y + 1} / span ${pos.h}`,
  };
}

export function DashboardBuilder({ dashboard }: DashboardBuilderProps) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>(dashboard.widgets);
  const [dragId, setDragId] = useState<string | null>(null);
  const saveLayout = useUpdateLayout();

  function swap(sourceId: string, targetId: string) {
    const src = widgets.find((w) => w.id === sourceId);
    const tgt = widgets.find((w) => w.id === targetId);
    if (!src || !tgt || sourceId === targetId) return;
    const next = widgets.map((w) => {
      if (w.id === sourceId) return { ...w, position: tgt.position };
      if (w.id === targetId) return { ...w, position: src.position };
      return w;
    });
    setWidgets(next);
    const positions: Record<string, WidgetPosition> = {};
    for (const w of next) positions[w.id] = w.position;
    void saveLayout.mutateAsync({ dashboardId: dashboard.id, positions });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-headline-md text-on-surface">{dashboard.name}</h2>
        {dashboard.description && (
          <p className="text-sm text-on-surface-variant">{dashboard.description}</p>
        )}
      </div>

      {widgets.length === 0 ? (
        <p className="rounded-md border border-outline-variant bg-surface-low p-4 text-sm text-on-surface-variant">
          Sin widgets. Añade widgets desde el explorador de consultas.
        </p>
      ) : (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gridAutoRows: '180px' }}
          data-testid="dashboard-grid"
        >
          {widgets.map((w) => (
            <div
              key={w.id}
              draggable
              onDragStart={() => setDragId(w.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) swap(dragId, w.id);
                setDragId(null);
              }}
              onDragEnd={() => setDragId(null)}
              style={cellStyle(w.position)}
              className="flex flex-col rounded-lg border border-outline-variant bg-surface-lowest p-3 shadow-card"
              data-testid={`widget-${w.id}`}
            >
              <div className="mb-2 cursor-grab text-[10px] uppercase tracking-wide text-on-surface-variant/60">
                ⠿ arrastrar
              </div>
              <div className="flex-1 overflow-hidden">
                <WidgetRenderer widget={w} />
              </div>
            </div>
          ))}
        </div>
      )}

      {saveLayout.isError && (
        <p className="text-sm text-red-600">No se pudo guardar el layout. Inténtalo de nuevo.</p>
      )}
      {saveLayout.isSuccess && saveLayout.variables && (
        <p className="text-xs text-on-surface-variant">Layout guardado.</p>
      )}
    </div>
  );
}

export default DashboardBuilder;