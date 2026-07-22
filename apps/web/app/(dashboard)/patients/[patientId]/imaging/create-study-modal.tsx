// apps/web/app/(dashboard)/patients/[patientId]/imaging/create-study-modal.tsx
// Modal to create a new imaging study and optionally upload files.

'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ImagingStudyType } from '@medicore/contracts';
import { useCreateImagingStudy } from '@/hooks/useImagingStudies';

interface CreateStudyModalProps {
  patientId: string;
  onClose: () => void;
}

const TYPE_OPTIONS: { value: ImagingStudyType; label: string }[] = [
  { value: 'XRAY', label: 'Radiografía' },
  { value: 'CT_SCAN', label: 'TC' },
  { value: 'MRI', label: 'RMN' },
  { value: 'ULTRASOUND', label: 'Ecografía' },
  { value: 'ENDOSCOPY', label: 'Endoscopía' },
  { value: 'OTHER', label: 'Otro' },
];

const ACCEPTED_FILE_TYPES = '.jpg,.jpeg,.png,.dcm,.dicom,.pdf,image/*,application/pdf';

type Phase = 'editing' | 'creating' | 'uploading' | 'done';

export function CreateStudyModal({ patientId, onClose }: CreateStudyModalProps) {
  const [type, setType] = useState<ImagingStudyType>('XRAY');
  const [date, setDate] = useState<string>(toDateInput(new Date()));
  const [bodyPart, setBodyPart] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('editing');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createMutation = useCreateImagingStudy(patientId);

  function toDateInput(d: Date): string {
    // Use local yyyy-mm-dd for the <input type=date> control.
    const yyyy = d.getFullYear().toString().padStart(4, '0');
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list) return;
    const next = Array.from(list);
    setFiles((prev) => [...prev, ...next]);
    // Reset the input so the same file can be re-added later if needed.
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhase('creating');
    try {
      const fullDescription = bodyPart
        ? `[${bodyPart}] ${description}`.trim()
        : description.trim();
      // CreateImagingStudySchema expects an ISO datetime for `date`.
      const isoDate = new Date(`${date}T00:00:00.000Z`).toISOString();
      const created = await createMutation.mutateAsync({
        type,
        date: isoDate,
        description: fullDescription || undefined,
      });

      // If the user attached files, upload them now against the new study id.
      if (files.length > 0) {
        setPhase('uploading');
        const formData = new FormData();
        for (const f of files) formData.append('files', f, f.name);
        const res = await fetch(
          `/v1/patients/${patientId}/imaging/${created.id}/files`,
          { method: 'POST', body: formData },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: res.statusText }));
          throw new Error(err.message ?? `Error de subida: ${res.status}`);
        }
      }

      setPhase('done');
      onClose();
    } catch (err) {
      setError((err as Error).message ?? 'No se pudo crear el estudio');
      setPhase('editing');
    }
  }

  const isWorking = phase === 'creating' || phase === 'uploading';
  const statusText =
    phase === 'creating'
      ? 'Creando estudio…'
      : phase === 'uploading'
        ? `Subiendo ${files.length} archivo(s)…`
        : null;

  const inputCls =
    'mt-1 block w-full rounded-md border border-outline px-3 py-2 text-sm shadow-card focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';
  const labelCls = 'block text-xs font-medium text-on-surface-variant';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isWorking) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-lg bg-surface-lowest shadow-xl">
        <div className="flex items-center justify-between border-b border-outline-variant px-6 py-4">
          <h2 className="text-base font-semibold text-on-surface">Nuevo estudio</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isWorking}
            aria-label="Cerrar"
          >
            ✕
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label htmlFor="study-type" className={labelCls}>
              Tipo *
            </label>
            <select
              id="study-type"
              value={type}
              onChange={(e) => setType(e.target.value as ImagingStudyType)}
              className={inputCls}
              required
              disabled={isWorking}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="study-date" className={labelCls}>
              Fecha *
            </label>
            <input
              id="study-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
              required
              disabled={isWorking}
            />
          </div>

          <div>
            <label htmlFor="study-bodyPart" className={labelCls}>
              Región / parte del cuerpo
            </label>
            <input
              id="study-bodyPart"
              type="text"
              value={bodyPart}
              onChange={(e) => setBodyPart(e.target.value)}
              placeholder="p. ej. Oído izquierdo"
              className={inputCls}
              disabled={isWorking}
            />
          </div>

          <div>
            <label htmlFor="study-description" className={labelCls}>
              Descripción
            </label>
            <textarea
              id="study-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Motivo del estudio o hallazgos preliminares"
              className={inputCls}
              disabled={isWorking}
            />
          </div>

          <div>
            <label htmlFor="study-files" className={labelCls}>
              Archivos (opcional)
            </label>
            <input
              id="study-files"
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_FILE_TYPES}
              onChange={handleFileChange}
              className={`${inputCls} file:mr-3 file:rounded file:border-0 file:bg-surface-container file:px-3 file:py-1 file:text-xs file:font-medium file:text-on-surface-variant hover:file:bg-surface-high`}
              disabled={isWorking}
            />
            <p className="mt-1 text-xs text-on-surface-variant/60">
              Imágenes (JPG, PNG, DICOM) o PDF. Se subirán tras crear el estudio.
            </p>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, idx) => (
                  <li
                    key={`${f.name}-${idx}`}
                    className="flex items-center justify-between rounded bg-surface-low px-2 py-1 text-xs text-on-surface-variant"
                  >
                    <span className="truncate">{f.name}</span>
                    <span className="ml-2 shrink-0 text-on-surface-variant/60">
                      {(f.size / 1024).toFixed(0)} KB
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(idx)}
                      disabled={isWorking}
                      aria-label={`Quitar ${f.name}`}
                    >
                      ✕
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {statusText && (
            <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-secondary-container/20 p-3 text-sm text-blue-700">
              <span
                className="h-3 w-3 animate-spin rounded-full border-2 border-secondary border-t-transparent"
                aria-hidden
              />
              {statusText}
            </div>
          )}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isWorking}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isWorking}
            >
              {phase === 'creating'
                ? 'Creando…'
                : phase === 'uploading'
                  ? 'Subiendo…'
                  : files.length > 0
                    ? 'Crear y subir'
                    : 'Crear estudio'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}