'use client';

import { useState } from 'react';

interface SummaryDownloadProps {
  patientId: string;
}

interface PatientInfo {
  id: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  sex?: string;
  nhc?: string;
}

interface AllergyInfo {
  id: string;
  substance: string;
  severity: string;
  status: string;
  reaction?: string;
  onsetDate?: string;
}

interface ConsultationInfo {
  id: string;
  date: string;
  type: string;
  chiefComplaint: string;
}

interface SurgeryInfo {
  id: string;
  date: string;
  procedureType: string;
  status: string;
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Not recorded';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function SummaryDownload({ patientId }: SummaryDownloadProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setGenerating(true);
    setError(null);

    try {
      const [patient, allergiesResult, consultationsResult, surgeriesResult] =
        await Promise.allSettled([
          apiFetch<PatientInfo>(`/v1/patients/${patientId}`),
          apiFetch<AllergyInfo[]>(`/v1/patients/${patientId}/allergies`),
          apiFetch<{ items: ConsultationInfo[] }>(
            `/v1/patients/${patientId}/consultations?page=1&pageSize=200&sortBy=date&sortOrder=desc`,
          ),
          apiFetch<{ items: SurgeryInfo[] }>(
            `/v1/patients/${patientId}/surgeries?page=1&pageSize=200&sortBy=date&sortOrder=desc`,
          ),
        ]);

      const patientData =
        patient.status === 'fulfilled' ? patient.value : null;
      const allergies =
        allergiesResult.status === 'fulfilled' ? allergiesResult.value : [];
      const consultations =
        consultationsResult.status === 'fulfilled'
          ? consultationsResult.value.items
          : [];
      const surgeries =
        surgeriesResult.status === 'fulfilled'
          ? surgeriesResult.value.items
          : [];

      const lines: string[] = [];

      lines.push('='.repeat(60));
      lines.push('PATIENT CLINICAL SUMMARY');
      lines.push('='.repeat(60));
      lines.push('');

      if (patientData) {
        lines.push('PATIENT INFORMATION');
        lines.push('-'.repeat(30));
        lines.push(`Name: ${patientData.firstName} ${patientData.lastName}`);
        if (patientData.nhc) lines.push(`NHC: ${patientData.nhc}`);
        lines.push(`Date of Birth: ${formatDate(patientData.birthDate)}`);
        lines.push(`Sex: ${patientData.sex ?? 'Not recorded'}`);
        lines.push(`ID: ${patientData.id}`);
      } else {
        lines.push('PATIENT INFORMATION');
        lines.push('-'.repeat(30));
        lines.push('(Could not load patient data)');
      }

      lines.push('');
      lines.push('ALLERGIES');
      lines.push('-'.repeat(30));
      if (allergies.length === 0) {
        lines.push('No known allergies recorded.');
      } else {
        for (const a of allergies) {
          lines.push(`  - ${a.substance} (${a.severity})`);
          if (a.reaction) lines.push(`    Reaction: ${a.reaction}`);
          lines.push(`    Status: ${a.status}`);
          if (a.onsetDate) lines.push(`    Onset: ${formatDate(a.onsetDate)}`);
        }
      }

      lines.push('');
      lines.push('CONSULTATION HISTORY');
      lines.push('-'.repeat(30));
      if (consultations.length === 0) {
        lines.push('No consultations recorded.');
      } else {
        for (const c of consultations) {
          lines.push(`  ${formatDate(c.date)} — ${c.type.replace(/_/g, ' ')}`);
          lines.push(`  Chief complaint: ${c.chiefComplaint}`);
          lines.push('');
        }
      }

      lines.push('');
      lines.push('SURGERY HISTORY');
      lines.push('-'.repeat(30));
      if (surgeries.length === 0) {
        lines.push('No surgeries recorded.');
      } else {
        for (const s of surgeries) {
          lines.push(`  ${formatDate(s.date)} — ${s.procedureType}`);
          lines.push(`  Status: ${s.status}`);
          lines.push('');
        }
      }

      lines.push('');
      lines.push('='.repeat(60));
      lines.push(`Generated: ${new Date().toLocaleString('en-US')}`);
      lines.push('MediCore Clinical Platform');

      const text = lines.join('\n');
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const patientName = patientData
        ? `${patientData.lastName}_${patientData.firstName}`
        : patientId.slice(0, 8);
      a.download = `clinical_summary_${patientName}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Clinical Summary</h3>
      <p className="mt-1 text-xs text-gray-500">
        Download a plain-text summary of the patient&apos;s clinical history including allergies,
        consultations, and surgeries.
      </p>
      {error && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <button
        onClick={handleDownload}
        disabled={generating}
        className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {generating ? (
          <>
            <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating...
          </>
        ) : (
          'Download Summary'
        )}
      </button>
    </div>
  );
}
