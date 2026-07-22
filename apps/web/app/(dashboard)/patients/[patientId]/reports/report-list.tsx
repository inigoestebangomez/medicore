'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useReports } from '@/hooks/useReports';
import type { ReportType, ReportStatus } from '@/hooks/useReports';

const TYPE_LABEL: Record<ReportType, string> = {
  DISCHARGE_SUMMARY: 'Discharge Summary',
  SURGICAL_REPORT: 'Surgical Report',
  REFERRAL_LETTER: 'Referral Letter',
  MEDICAL_CERTIFICATE: 'Medical Certificate',
  FOLLOW_UP_REPORT: 'Follow-up Report',
  PATHOLOGY_REPORT: 'Pathology Report',
};

const TYPE_BADGE: Record<ReportType, string> = {
  DISCHARGE_SUMMARY: 'bg-purple-100 text-purple-800',
  SURGICAL_REPORT: 'bg-indigo-100 text-indigo-800',
  REFERRAL_LETTER: 'bg-teal-100 text-teal-800',
  MEDICAL_CERTIFICATE: 'bg-amber-100 text-amber-800',
  FOLLOW_UP_REPORT: 'bg-green-100 text-green-800',
  PATHOLOGY_REPORT: 'bg-pink-100 text-pink-800',
};

const STATUS_LABEL: Record<ReportStatus, string> = {
  DRAFT: 'Draft',
  REVIEWED: 'Reviewed',
  SIGNED: 'Signed',
};

const STATUS_BADGE: Record<ReportStatus, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  REVIEWED: 'bg-blue-100 text-blue-800',
  SIGNED: 'bg-green-100 text-green-800',
};

interface ReportListProps {
  patientId: string;
}

export function ReportList({ patientId }: ReportListProps) {
  const router = useRouter();
  const { data: reports, isLoading, error } = useReports(patientId);
  const [menuOpen, setMenuOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-outline-variant border-t-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
        Error loading reports: {error.message}
      </div>
    );
  }

  const items = reports ?? [];

  return (
    <div className="container mx-auto space-y-4 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-on-surface">Reports</h2>
        <div className="relative">
          <Button
            size="sm"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            New Report
          </Button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-40 rounded-md border border-outline-variant bg-surface-lowest shadow-lg">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    router.push(`/patients/${patientId}/reports/generate`);
                  }}
                  className="block w-full px-4 py-2 text-left text-sm text-on-surface-variant hover:bg-surface-container rounded-t-md"
                >
                  AI Generate
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    router.push(`/patients/${patientId}/reports/new`);
                  }}
                  className="block w-full px-4 py-2 text-left text-sm text-on-surface-variant hover:bg-surface-container rounded-b-md"
                >
                  Write Manually
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-outline-variant bg-surface-lowest p-8 text-center">
          <p className="text-sm text-on-surface-variant">No reports yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((report) => (
            <div
              key={report.id}
              onClick={() => router.push(`/patients/${patientId}/reports/${report.id}`)}
              className="cursor-pointer rounded-lg border border-outline-variant bg-surface-lowest p-4 hover:bg-surface-low transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-on-surface truncate">
                      {report.title}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_BADGE[report.type]}`}
                    >
                      {TYPE_LABEL[report.type]}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[report.status]}`}
                    >
                      {STATUS_LABEL[report.status]}
                    </span>
                    {report.aiGenerated && (
                      <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">
                        AI
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant/60">
                    {new Date(report.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
