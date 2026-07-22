'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useCreateReport } from '@/hooks/useReports';
import type { ReportType } from '@/hooks/useReports';

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: 'DISCHARGE_SUMMARY', label: 'Discharge Summary' },
  { value: 'SURGICAL_REPORT', label: 'Surgical Report' },
  { value: 'REFERRAL_LETTER', label: 'Referral Letter' },
  { value: 'MEDICAL_CERTIFICATE', label: 'Medical Certificate' },
  { value: 'FOLLOW_UP_REPORT', label: 'Follow-up Report' },
  { value: 'PATHOLOGY_REPORT', label: 'Pathology Report' },
];

interface ManualReportFormProps {
  patientId: string;
}

export function ManualReportForm({ patientId }: ManualReportFormProps) {
  const router = useRouter();
  const createReport = useCreateReport(patientId);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<ReportType>('DISCHARGE_SUMMARY');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const result = await createReport.mutateAsync({ title, content, type });
      router.push(`/patients/${patientId}/reports/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create report');
    }
  };

  return (
    <div className="container mx-auto max-w-3xl space-y-6 py-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/patients/${patientId}/reports`}
          className="text-sm text-on-surface-variant hover:text-on-surface-variant"
        >
          &larr; Back to Reports
        </Link>
      </div>

      <h2 className="text-lg font-semibold text-on-surface">New Manual Report</h2>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-on-surface-variant mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-md border border-outline px-3 py-2 text-sm shadow-card focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Report title"
          />
        </div>

        <div>
          <label htmlFor="type" className="block text-sm font-medium text-on-surface-variant mb-1">
            Type <span className="text-red-500">*</span>
          </label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as ReportType)}
            required
            className="w-full rounded-md border border-outline px-3 py-2 text-sm shadow-card focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {REPORT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="content" className="block text-sm font-medium text-on-surface-variant mb-1">
            Content <span className="text-red-500">*</span>
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={20}
            className="w-full rounded-md border border-outline px-3 py-2 text-sm shadow-card focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            placeholder="Write report content (markdown)..."
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            size="sm"
            disabled={createReport.isPending}
          >
            {createReport.isPending ? 'Creating...' : 'Create Report'}
          </Button>
          <Link
            href={`/patients/${patientId}/reports`}
            className="rounded-md border border-outline px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-low"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
