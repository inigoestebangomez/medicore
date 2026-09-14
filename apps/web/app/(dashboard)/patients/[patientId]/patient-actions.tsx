'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

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
      <div className="rounded-lg border border-outline-variant bg-surface-lowest p-6 shadow-card">
         <h3 className="text-sm font-semibold text-on-surface">Exportar datos del paciente</h3>
        <p className="mt-1 text-xs text-on-surface-variant">
           Descarga el historial clínico completo en formato JSON compatible con FHIR R4.
        </p>
        {exportError && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {exportError}
          </div>
        )}
        <Button
          size="sm"
          onClick={handleExport}
          disabled={exporting}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
           {exporting ? 'Exportando...' : 'Exportar JSON'}
        </Button>
      </div>

      <div className="rounded-lg border border-outline-variant bg-surface-lowest p-6 shadow-card">
         <h3 className="text-sm font-semibold text-on-surface">Descargar resumen</h3>
        <p className="mt-1 text-xs text-on-surface-variant">
           Descarga un resumen de texto sin formato del historial de este paciente.
        </p>
        <a
          href={`/patients/${patientId}/summary`}
          className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
           Descargar resumen
        </a>
      </div>

      <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-card">
        <h3 className="text-sm font-semibold text-red-800">Anonimizar paciente</h3>
        <p className="mt-1 text-xs text-red-600">
           Esta acción es <strong>IRREVERSIBLE</strong>. Se eliminarán permanentemente todos los datos personales identificables (nombre, contacto y documentos). Los datos clínicos se conservarán por obligación legal.
        </p>
        {anonymizeError && (
          <div className="mt-3 rounded border border-red-300 bg-surface-lowest p-3 text-sm text-red-700">
            {anonymizeError}
          </div>
        )}
        {anonymized ? (
          <div className="mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
             El paciente se ha anonimizado correctamente. Los datos personales no se pueden recuperar.
          </div>
        ) : showAnonymizeConfirm ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-medium text-red-800">
               ¿Estás completamente seguro? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <Button
                size="sm"
                onClick={handleAnonymize}
                disabled={anonymizing}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                 {anonymizing ? 'Anonimizando...' : 'Sí, anonimizar permanentemente'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAnonymizeConfirm(false)}
                disabled={anonymizing}
              >
                 Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAnonymizeConfirm(true)}
            className="border-red-300 text-red-700 hover:bg-red-50"
          >
             Anonimizar paciente
          </Button>
        )}
      </div>
    </div>
  );
}
