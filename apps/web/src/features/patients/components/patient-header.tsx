// apps/web/src/features/patients/components/patient-header.tsx
// PatientHeader with tab navigation for patient sub-sections (BR: wire meds + scales tabs)

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface PatientHeaderProps {
  patientId: string;
  patientName?: string;
}

interface TabDef {
  href: string;
  label: string;
  match: (pathname: string, href: string) => boolean;
}

function buildTabs(patientId: string): TabDef[] {
  const base = `/patients/${patientId}`;
  return [
    {
      href: base,
      label: 'Overview',
      match: (pathname, href) => pathname === href,
    },
    {
      href: `${base}/medications`,
      label: 'Medications',
      match: (pathname, href) => pathname === href || pathname.startsWith(`${href}/`),
    },
    {
      href: `${base}/consultations`,
      label: 'Consultations',
      match: (pathname, href) => pathname === href || pathname.startsWith(`${href}/`),
    },
    {
      href: `${base}/scales`,
      label: 'Clinical Scales',
      match: (pathname, href) => pathname === href || pathname.startsWith(`${href}/`),
    },
    {
      href: `${base}/surgeries`,
      label: 'Surgeries',
      match: (pathname, href) => pathname === href || pathname.startsWith(`${href}/`),
    },
    {
      href: `${base}/reports`,
      label: 'Reports',
      match: (pathname, href) => pathname === href || pathname.startsWith(`${href}/`),
    },
    {
      href: `${base}/imaging`,
      label: 'Imaging',
      match: (pathname, href) => pathname === href || pathname.startsWith(`${href}/`),
    },
  ];
}

export function PatientHeader({ patientId, patientName }: PatientHeaderProps) {
  const pathname = usePathname() ?? '';
  const tabs = buildTabs(patientId);
  // patientName is optional; if not provided, the header shows just tabs.
  const [showId] = useState(patientId);

  return (
    <div className="border-b border-outline-variant bg-surface-lowest">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex items-baseline justify-between py-3">
          <div>
            <h1 className="text-xl font-semibold text-on-surface">
              {patientName ?? 'Patient'}
            </h1>
            <p className="text-xs text-on-surface-variant/60">ID: {showId}</p>
          </div>
        </div>
        <nav className="flex gap-1" aria-label="Patient sections">
          {tabs.map((tab) => {
            const active = tab.match(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:border-outline hover:text-on-surface-variant'
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