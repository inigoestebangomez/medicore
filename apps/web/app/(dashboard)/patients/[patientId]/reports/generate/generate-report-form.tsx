'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useGenerateReport } from '@/hooks/useReports';
import type { ReportType } from '@/hooks/useReports';

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: 'DISCHARGE_SUMMARY', label: 'Discharge Summary' },
  { value: 'SURGICAL_REPORT', label: 'Surgical Report' },
  { value: 'REFERRAL_LETTER', label: 'Referral Letter' },
  { value: 'MEDICAL_CERTIFICATE', label: 'Medical Certificate' },
  { value: 'FOLLOW_UP_REPORT', label: 'Follow-up Report' },
  { value: 'PATHOLOGY_REPORT', label: 'Pathology Report' },
];

interface SourceItem {
  id: string;
  [key: string]: unknown;
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

function useConsultationsForSelect(patientId: string) {
  return useQuery<SourceItem[]>({
    queryKey: ['consultations', patientId, 'list'],
    queryFn: async () => {
      const res = await apiFetch<{
        data: { items: SourceItem[] };
      }>(`/v1/patients/${patientId}/consultations?pageSize=100&sortBy=date&sortOrder=desc`);
      return res.data.items;
    },
    enabled: !!patientId,
  });
}

function useSurgeriesForSelect(patientId: string) {
  return useQuery<SourceItem[]>({
    queryKey: ['surgeries', patientId, 'list'],
    queryFn: async () => {
      const res = await apiFetch<{
        data: { items: SourceItem[] };
      }>(`/v1/patients/${patientId}/surgeries?pageSize=100&sortBy=date&sortOrder=desc`);
      return res.data.items;
    },
    enabled: !!patientId,
  });
}

interface GenerateReportFormProps {
  patientId: string;
}

export function GenerateReportForm({ patientId }: GenerateReportFormProps) {
  const router = useRouter();
  const generateReport = useGenerateReport(patientId);

  const [sourceType, setSourceType] = useState<'consultation' | 'surgery'>('consultation');
  const [sourceId, setSourceId] = useState('');
  const [reportType, setReportType] = useState<ReportType>('DISCHARGE_SUMMARY');
  const [error, setError] = useState<string | null>(null);

  const {
    data: consultations,
    isLoading: consultationsLoading,
  } = useConsultationsForSelect(patientId);
  const {
    data: surgeries,
    isLoading: surgeriesLoading,
  } = useSurgeriesForSelect(patientId);

  const sourceLoading = sourceType === 'consultation' ? consultationsLoading : surgeriesLoading;
  const sources = sourceType === 'consultation' ? (consultations ?? []) : (surgeries ?? []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!sourceId) {
      setError('Please select a source');
      return;
    }

    try {
      const result = await generateReport.mutateAsync({
        sourceType,
        sourceId,
        reportType,
      });
      router.push(`/patients/${patientId}/reports/${result.reportId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    }
  };

  const formatSourceLabel = (item: SourceItem): string => {
    if (sourceType === 'consultation') {
      const date = (item as any).date
        ? new Date((item as any).date).toLocaleDateString()
        : '';
      const complaint = (item as any).chiefComplaint ?? '';
      return `${date} — ${complaint}`;
    }
    const date = (item as any).date
      ? new Date((item as any).date).toLocaleDateString()
      : '';
    const procedure = (item as any).procedureType ?? '';
    return `${date} — ${procedure}`;
  };

  return (
    <div className="container mx-auto max-w-3xl space-y-6 py-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/patients/${patientId}/reports`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to Reports
        </Link>
      </div>

      <h2 className="text-lg font-semibold text-gray-900">Generate AI Report</h2>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="sourceType" className="block text-sm font-medium text-gray-700 mb-1">
            Source Type <span className="text-red-500">*</span>
          </label>
          <select
            id="sourceType"
            value={sourceType}
            onChange={(e) => {
              setSourceType(e.target.value as 'consultation' | 'surgery');
              setSourceId('');
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="consultation">Consultation</option>
            <option value="surgery">Surgery</option>
          </select>
        </div>

        <div>
          <label htmlFor="sourceId" className="block text-sm font-medium text-gray-700 mb-1">
            {sourceType === 'consultation' ? 'Consultation' : 'Surgery'}{' '}
            <span className="text-red-500">*</span>
          </label>
          {sourceLoading ? (
            <div className="flex items-center gap-2 py-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
              <span className="text-sm text-gray-400">Loading...</span>
            </div>
          ) : (
            <select
              id="sourceId"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Select {sourceType === 'consultation' ? 'a consultation' : 'a surgery'}...</option>
              {sources.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatSourceLabel(item)}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label htmlFor="reportType" className="block text-sm font-medium text-gray-700 mb-1">
            Report Type <span className="text-red-500">*</span>
          </label>
          <select
            id="reportType"
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {REPORT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={generateReport.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generateReport.isPending ? 'Generating AI report...' : 'Generate'}
          </button>
          <Link
            href={`/patients/${patientId}/reports`}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>

        {generateReport.isPending && (
          <div className="flex items-center gap-3 rounded-md bg-blue-50 p-4 text-sm text-blue-700">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            <span>Generating AI report... This may take up to 30 seconds.</span>
          </div>
        )}
      </form>
    </div>
  );
}
