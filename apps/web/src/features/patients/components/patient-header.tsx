// apps/web/src/features/patients/components/patient-header.tsx
// PatientHeader with tab navigation for patient sub-sections (BR: wire meds + scales tabs)

'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';

interface PatientHeaderProps {
  patientId: string;
  patientName?: string;
}

interface TabDef {
  href: string;
  label: string;
  match: (pathname: string, searchParams: URLSearchParams, href: string) => boolean;
}

function matchesSection(
  pathname: string,
  searchParams: URLSearchParams,
  href: string,
  section: string,
): boolean {
  const path = href.split('?')[0];
  return (pathname === path || pathname.startsWith(`${path}/`)) && searchParams.get('section') === section;
}

function buildTabs(patientId: string): TabDef[] {
  const base = `/patients/${patientId}`;
  return [
    {
      href: base,
      label: 'Resumen',
      match: (pathname, _searchParams, href) => pathname === href,
    },
    {
      // Seven-category clinical record (gated by CLINICAL_RECORD_V2 flag)
      href: `${base}/clinical-record`,
      label: 'Historia clínica',
      match: (pathname, _searchParams, href) =>
        pathname === href || pathname.startsWith(`${href}/`),
    },
    {
      href: `${base}/surgeries`,
      label: 'Cirugías',
      match: (pathname, _searchParams, href) => pathname === href || pathname.startsWith(`${href}/`),
    },
    {
      href: `${base}/imaging`,
      label: 'Imágenes',
      match: (pathname, _searchParams, href) => pathname === href || pathname.startsWith(`${href}/`),
    },
    {
      href: `${base}/reports`,
      label: 'Informes',
      match: (pathname, _searchParams, href) => pathname === href || pathname.startsWith(`${href}/`),
    },
  ];
}

export function PatientHeader({ patientId, patientName }: PatientHeaderProps) {
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const tabs = buildTabs(patientId);
  // patientName is optional; if not provided, the header shows just tabs.
  const [showId] = useState(patientId);

  return (
    <div className="border-b border-outline-variant bg-surface-lowest">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex items-baseline justify-between py-3">
          <div>
            <h1 className="text-xl font-semibold text-on-surface">
              {patientName ?? 'Paciente'}
            </h1>
            <p className="text-xs text-on-surface-variant/60">ID: {showId}</p>
          </div>
        </div>
        <nav className="flex gap-1" aria-label="Secciones del paciente">
          {tabs.map((tab) => {
            const active = tab.match(pathname, searchParams, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:border-outline hover:text-on-surface'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
