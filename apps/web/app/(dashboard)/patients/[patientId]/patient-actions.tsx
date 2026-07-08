'use client';

import { useState } from 'react';

interface PatientActionsProps {
  patientId: string;
}

export function PatientActions({ patientId }: PatientActionsProps) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [showAnonymizeConfirm, setShowAnonymizeConfirm] = useState(false);
  const [anonymizing, setAnonymizing] = useState(false);
  const [anonymizeError, setAnonymizeError] = useState<string | null>(null);
  const [anonymized, setAnonymized] = useState(false);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch(`/v1/export/patients/${patientId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Export failed' }));
        throw new Error(err.message ?? `Export failed: ${res.status}`);
      }
      const json = await res.json();

      const blob = new Blob([JSON.stringify(json.data ?? json, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patient-${patientId}-export.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError((error as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function handleAnonymize() {
    setAnonymizing(true);
    setAnonymizeError(null);
    try {
      const res = await fetch(`/v1/patients/${patientId}/anonymize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'GDPR right to be forgotten request' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Anonymization failed' }));
        throw new Error(err.message ?? `Anonymization failed: ${res.status}`);
      }
      setAnonymized(true);
      setShowAnonymizeConfirm(false);
    } catch (error) {
      setAnonymizeError((error as Error).message);
    } finally {
      setAnonymizing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Export Patient Data</h3>
        <p className="mt-1 text-xs text-gray-500">
          Download the complete clinical history in FHIR R4-compatible JSON format.
        </p>
        {exportError && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {exportError}
          </div>
        )}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exporting ? (
            <>
              <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Exporting...
            </>
          ) : (
            'Export JSON'
          )}
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Download Summary</h3>
        <p className="mt-1 text-xs text-gray-500">
          Download a plain-text clinical summary of this patient&apos;s history.
        </p>
        <a
          href={`/patients/${patientId}/summary`}
          className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Download Summary
        </a>
      </div>

      <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-red-800">Anonymize Patient</h3>
        <p className="mt-1 text-xs text-red-600">
          This action is <strong>IRREVERSIBLE</strong>. All personally identifiable information (name, contact, documents) will be permanently removed. Clinical data is preserved for legal retention.
        </p>
        {anonymizeError && (
          <div className="mt-3 rounded border border-red-300 bg-white p-3 text-sm text-red-700">
            {anonymizeError}
          </div>
        )}
        {anonymized ? (
          <div className="mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            Patient has been anonymized successfully. PII data cannot be recovered.
          </div>
        ) : showAnonymizeConfirm ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-medium text-red-800">
              Are you absolutely sure? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleAnonymize}
                disabled={anonymizing}
                className="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {anonymizing ? 'Anonymizing...' : 'Yes, anonymize permanently'}
              </button>
              <button
                onClick={() => setShowAnonymizeConfirm(false)}
                disabled={anonymizing}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAnonymizeConfirm(true)}
            className="mt-4 inline-flex items-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Anonymize Patient
          </button>
        )}
      </div>
    </div>
  );
}
