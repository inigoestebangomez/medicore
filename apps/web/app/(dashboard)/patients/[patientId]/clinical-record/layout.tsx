// apps/web/app/(dashboard)/patients/[patientId]/clinical-record/layout.tsx
// Seven-category clinical record navigation.
// Replaces the scattered 10-tab approach with a single, stable category nav.
// Gated behind CLINICAL_RECORD_V2 feature flag.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import type { ClinicalRecordCategory } from '@medicore/contracts';

interface CategoryTab {
  category: ClinicalRecordCategory;
  label: string;
  segment: string;
}

const CATEGORIES: CategoryTab[] = [
  { category: 'patient-data', label: 'Datos del paciente', segment: 'patient-data' },
  { category: 'history', label: 'Antecedentes', segment: 'history' },
  { category: 'current-illness', label: 'Enfermedad actual', segment: 'current-illness' },
  { category: 'physical-exam', label: 'Exploración física', segment: 'physical-exam' },
  { category: 'complementary-tests', label: 'Pruebas complementarias', segment: 'complementary-tests' },
  { category: 'diagnosis', label: 'Diagnóstico', segment: 'diagnosis' },
  { category: 'treatment', label: 'Tratamiento', segment: 'treatment' },
];

interface ClinicalRecordLayoutProps {
  children: React.ReactNode;
  params: { patientId: string };
}

export default function ClinicalRecordLayout({
  children,
  params,
}: ClinicalRecordLayoutProps) {
  const pathname = usePathname() ?? '';
  const isEnabled = useFeatureFlag('CLINICAL_RECORD_V2');
  const { patientId } = params;
  const base = `/patients/${patientId}/clinical-record`;

  if (!isEnabled) {
    return (
      <div className="py-8 text-center text-sm text-on-surface-variant">
        <p>La historia clínica estructurada está desactivada.</p>
        <p className="mt-1 text-xs text-on-surface-variant/60">
          Activa el flag <code className="rounded bg-surface-low px-1 py-0.5 font-mono text-xs">CLINICAL_RECORD_V2</code> para habilitarla.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Category tab navigation */}
      <nav
        className="flex gap-1 overflow-x-auto border-b border-outline-variant"
        aria-label="Categorías de la historia clínica"
        data-testid="clinical-record-tabs"
      >
        {CATEGORIES.map((tab) => {
          const href = `${base}/${tab.segment}`;
          const isActive =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={tab.category}
              href={href}
              data-testid={`tab-${tab.category}`}
              className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:border-outline hover:text-on-surface'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Category content */}
      <div data-testid="clinical-record-content">{children}</div>
    </div>
  );
}
