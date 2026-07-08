'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useReport, useUpdateReport, useSignReport } from '@/hooks/useReports';
import type { ReportStatus } from '@/hooks/useReports';

const STATUS_BADGE: Record<ReportStatus, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  REVIEWED: 'bg-blue-100 text-blue-800',
  SIGNED: 'bg-green-100 text-green-800',
};

const STATUS_LABEL: Record<ReportStatus, string> = {
  DRAFT: 'Draft',
  REVIEWED: 'Reviewed',
  SIGNED: 'Signed',
};

interface ReportDetailProps {
  patientId: string;
  reportId: string;
}

export function ReportDetail({ patientId, reportId }: ReportDetailProps) {
  const { data: report, isLoading, error } = useReport(patientId, reportId);
  const updateReport = useUpdateReport(patientId);
  const signReport = useSignReport(patientId);

  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [showSignConfirm, setShowSignConfirm] = useState(false);
  const [disclaimerConfirmed, setDisclaimerConfirmed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="container mx-auto py-6">
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error?.message || 'Report not found'}
        </div>
        <Link
          href={`/patients/${patientId}/reports`}
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          &larr; Back to Reports
        </Link>
      </div>
    );
  }

  const canEdit = report.status !== 'SIGNED';
  const canSign = report.status === 'REVIEWED';

  const handleStartEdit = () => {
    setEditContent(report.content);
    setEditing(true);
    setActionError(null);
  };

  const handleSave = async () => {
    setActionError(null);
    try {
      await updateReport.mutateAsync({ id: reportId, data: { content: editContent } });
      setEditing(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update report');
    }
  };

  const handleSign = async () => {
    if (!disclaimerConfirmed) return;
    setActionError(null);
    try {
      await signReport.mutateAsync(reportId);
      setShowSignConfirm(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to sign report');
    }
  };

  return (
    <div className="container mx-auto max-w-3xl space-y-6 py-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/patients/${patientId}/reports`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to Reports
        </Link>
        <div className="flex items-center gap-2">
          {canEdit && !editing && (
            <button
              onClick={handleStartEdit}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Edit
            </button>
          )}
          {canSign && !editing && (
            <button
              onClick={() => {
                setShowSignConfirm(true);
                setDisclaimerConfirmed(false);
                setActionError(null);
              }}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Sign
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{actionError}</div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-semibold text-gray-900">{report.title}</h2>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[report.status]}`}
          >
            {STATUS_LABEL[report.status]}
          </span>
          {report.aiGenerated && (
            <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">
              AI Generated
            </span>
          )}
        </div>

        <div className="text-xs text-gray-400 space-y-1">
          <p>
            Created: {new Date(report.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          {report.signedAt && (
            <p>
              Signed: {new Date(report.signedAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>

        <div className="border-t border-gray-200 pt-4">
          {editing ? (
            <div className="space-y-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={20}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={updateReport.isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateReport.isPending ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">
              {report.content}
            </div>
          )}
        </div>
      </div>

      {showSignConfirm && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          <h3 className="text-base font-semibold text-gray-900">Sign Report</h3>
          <p className="text-sm text-gray-600">
            By signing this report, you certify that you have reviewed the content
            and confirm it is accurate and complete. Signed reports cannot be modified.
          </p>
          <label className="flex items-center gap-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={disclaimerConfirmed}
              onChange={(e) => setDisclaimerConfirmed(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            I confirm that I have reviewed this report and it is accurate.
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSign}
              disabled={!disclaimerConfirmed || signReport.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {signReport.isPending ? 'Signing...' : 'Confirm and Sign'}
            </button>
            <button
              onClick={() => setShowSignConfirm(false)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
