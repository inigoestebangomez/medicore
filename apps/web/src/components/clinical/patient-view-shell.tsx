import { AnatomyViewer3D } from './anatomy-viewer-3d/anatomy-viewer-3d';
import type { AnatomyZoneKey } from '@/lib/orl-anatomy-map';
import type { ReactNode } from 'react';

type Severity = 'critical' | 'warning' | 'info';

interface PatientViewShellProps {
  activeZones: AnatomyZoneKey[];
  severity: Record<string, Severity>;
  onZoneClick?: (zone: string) => void;
  /** Center column content (clinical timeline, forms) */
  centerContent: ReactNode;
  /** Right column content (medication, alerts, quick actions) */
  rightContent: ReactNode;
  /** Optional content below the 3-column grid (full width) */
  bottomContent?: ReactNode;
  /** Whether the patient has any critical diagnoses — stops model rotation */
  hasCritical: boolean;
}

export function PatientViewShell({
  activeZones,
  severity,
  onZoneClick,
  centerContent,
  rightContent,
  bottomContent,
  hasCritical,
}: PatientViewShellProps) {
  return (
    <div className="space-y-6">
      {/* 3-column grid (Section 9: 1fr 2fr 1fr) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] gap-6 max-w-[1600px]">
        {/* Column 1: 3D Model */}
        <div>
          <div className="card-primary p-0 overflow-hidden">
            <AnatomyViewer3D
              activeZones={activeZones}
              severity={severity}
              onZoneClick={onZoneClick}
              rotating={!hasCritical}
              className="min-h-[350px]"
            />
            {/* Zone legend */}
            <div className="px-4 py-3 border-t border-outline-variant">
              {activeZones.length === 0 ? (
                <p className="text-xs text-on-surface-variant/60">Sin patología activa registrada</p>
              ) : (
                <ul className="space-y-1">
                  {activeZones.slice(0, 5).map((zone) => (
                    <li key={zone} className="text-xs text-on-surface-variant flex items-center gap-2">
                      <span 
                        className={`w-2 h-2 rounded-full ${
                          severity[zone] === 'critical' ? 'bg-rose-500' :
                          severity[zone] === 'warning' ? 'bg-amber-500' :
                          'bg-aqua-500'
                        }`}
                      />
                      {zone}
                    </li>
                  ))}
                  {activeZones.length > 5 && (
                    <li className="text-xs text-on-surface-variant/60">+{activeZones.length - 5} más</li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Column 2: Center content */}
        <div className="space-y-4">
          {centerContent}
        </div>

        {/* Column 3: Right panel */}
        <div className="space-y-4">
          {rightContent}
        </div>
      </div>

      {/* Bottom full-width content */}
      {bottomContent && (
        <div className="max-w-[1600px]">
          {bottomContent}
        </div>
      )}
    </div>
  );
}
