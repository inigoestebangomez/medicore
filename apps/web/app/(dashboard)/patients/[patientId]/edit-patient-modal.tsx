// apps/web/app/(dashboard)/patients/[patientId]/edit-patient-modal.tsx
// Modal form to edit a patient's demographic data. Uses useUpdatePatient hook.

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type {
  PatientResponse,
  UpdatePatientInput,
  Sex,
  IdDocumentType,
  BloodType,
} from '@medicore/contracts';
import { useUpdatePatient } from '@/hooks/usePatients';

interface EditPatientModalProps {
  patient: PatientResponse;
}

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'MALE', label: 'Masculino' },
  { value: 'FEMALE', label: 'Femenino' },
  { value: 'OTHER', label: 'Otro' },
  { value: 'UNKNOWN', label: 'Desconocido' },
];

const ID_DOC_OPTIONS: { value: IdDocumentType; label: string }[] = [
  { value: 'DNI', label: 'DNI' },
  { value: 'NIE', label: 'NIE' },
  { value: 'PASSPORT', label: 'Pasaporte' },
  { value: 'OTHER', label: 'Otro' },
];

const BLOOD_TYPE_OPTIONS: { value: BloodType; label: string }[] = [
  { value: 'A_POS', label: 'A+' },
  { value: 'A_NEG', label: 'A-' },
  { value: 'B_POS', label: 'B+' },
  { value: 'B_NEG', label: 'B-' },
  { value: 'AB_POS', label: 'AB+' },
  { value: 'AB_NEG', label: 'AB-' },
  { value: 'O_POS', label: 'O+' },
  { value: 'O_NEG', label: 'O-' },
  { value: 'UNKNOWN', label: 'Desconocido' },
];

// Convert an ISO date string (e.g. "1990-05-20T00:00:00.000Z") to yyyy-mm-dd
// for <input type="date">. Returns '' if invalid.
function toDateInput(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = d.getUTCDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Build the UpdatePatientInput payload from form state.
function buildPayload(form: FormState): UpdatePatientInput {
  const payload: UpdatePatientInput = {
    firstName: form.firstName,
    lastName: form.lastName,
  };
  if (form.birthDate) payload.birthDate = new Date(form.birthDate).toISOString();
  if (form.sex) payload.sex = form.sex as Sex;
  if (form.phone !== '') payload.phone = form.phone;
  else payload.phone = null;
  if (form.email !== '') payload.email = form.email;
  else payload.email = null;
  if (form.idDocType) payload.idDocType = form.idDocType as IdDocumentType;
  if (form.idDocument !== '') payload.idDocument = form.idDocument;
  else payload.idDocument = null;
  if (form.bloodType) payload.bloodType = form.bloodType as BloodType;
  if (form.address !== '') payload.address = { street: form.address };
  else payload.address = null;
  payload.notes = form.notes !== '' ? form.notes : null;
  payload.emergencyContact = {
    name: form.ecName,
    phone: form.ecPhone,
    relationship: form.ecRelationship,
  };
  return payload;
}

interface FormState {
  firstName: string;
  lastName: string;
  birthDate: string;
  sex: string;
  phone: string;
  email: string;
  idDocType: string;
  idDocument: string;
  bloodType: string;
  address: string;
  ecName: string;
  ecPhone: string;
  ecRelationship: string;
  notes: string;
}

function readAddressAsString(patient: PatientResponse): string {
  const addr = patient.address;
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  if (typeof addr === 'object') {
    const a = addr as Record<string, unknown>;
    return [a.street, a.city, a.postalCode, a.country].filter(Boolean).join(', ');
  }
  return '';
}

function readEmergencyField(ec: unknown, field: string): string {
  if (!ec || typeof ec !== 'object') return '';
  const e = ec as Record<string, unknown>;
  return typeof e[field] === 'string' ? (e[field] as string) : '';
}

export function EditPatientModal({ patient }: EditPatientModalProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const updateMutation = useUpdatePatient();

  const [form, setForm] = useState<FormState>(() => ({
    firstName: patient.firstName ?? '',
    lastName: patient.lastName ?? '',
    birthDate: toDateInput(patient.birthDate),
    sex: patient.sex ?? '',
    phone: patient.phone ?? '',
    email: patient.email ?? '',
    idDocType: patient.idDocType ?? '',
    idDocument: patient.idDocument ?? '',
    bloodType: patient.bloodType ?? '',
    address: readAddressAsString(patient),
    ecName: readEmergencyField(patient.emergencyContact, 'name'),
    ecPhone: readEmergencyField(patient.emergencyContact, 'phone'),
    ecRelationship: readEmergencyField(patient.emergencyContact, 'relationship'),
    notes: patient.notes ?? '',
  }));

  // Reset form when a different patient is passed in or modal reopens.
  useEffect(() => {
    if (!open) return;
    setForm({
      firstName: patient.firstName ?? '',
      lastName: patient.lastName ?? '',
      birthDate: toDateInput(patient.birthDate),
      sex: patient.sex ?? '',
      phone: patient.phone ?? '',
      email: patient.email ?? '',
      idDocType: patient.idDocType ?? '',
      idDocument: patient.idDocument ?? '',
      bloodType: patient.bloodType ?? '',
      address: readAddressAsString(patient),
      ecName: readEmergencyField(patient.emergencyContact, 'name'),
      ecPhone: readEmergencyField(patient.emergencyContact, 'phone'),
      ecRelationship: readEmergencyField(patient.emergencyContact, 'relationship'),
      notes: patient.notes ?? '',
    });
    setStatus('idle');
  }, [open, patient]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('idle');
    try {
      await updateMutation.mutateAsync({ id: patient.id, ...buildPayload(form) });
      setStatus('success');
      setTimeout(() => {
        setOpen(false);
        setStatus('idle');
      }, 800);
    } catch {
      setStatus('error');
    }
  }

  const inputCls =
    'mt-1 block w-full rounded-md border border-outline px-3 py-2 text-sm shadow-card focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';
  const labelCls = 'block text-xs font-medium text-on-surface-variant';

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
      >
        Editar paciente
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-surface-lowest shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-outline-variant bg-surface-lowest px-6 py-4">
              <h2 className="text-base font-semibold text-on-surface">
                Editar paciente
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
              >
                ✕
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className={labelCls}>
                    Nombre *
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    required
                    value={form.firstName}
                    onChange={(e) => update('firstName', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className={labelCls}>
                    Apellidos *
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    required
                    value={form.lastName}
                    onChange={(e) => update('lastName', e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="birthDate" className={labelCls}>
                    Fecha de nacimiento
                  </label>
                  <input
                    id="birthDate"
                    type="date"
                    value={form.birthDate}
                    onChange={(e) => update('birthDate', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="sex" className={labelCls}>
                    Sexo
                  </label>
                  <select
                    id="sex"
                    value={form.sex}
                    onChange={(e) => update('sex', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">—</option>
                    {SEX_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="phone" className={labelCls}>
                    Teléfono
                  </label>
                  <input
                    id="phone"
                    type="text"
                    value={form.phone}
                    onChange={(e) => update('phone', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="email" className={labelCls}>
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="idDocType" className={labelCls}>
                    Tipo de documento
                  </label>
                  <select
                    id="idDocType"
                    value={form.idDocType}
                    onChange={(e) => update('idDocType', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">—</option>
                    {ID_DOC_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="idDocument" className={labelCls}>
                    Nº de documento
                  </label>
                  <input
                    id="idDocument"
                    type="text"
                    value={form.idDocument}
                    onChange={(e) => update('idDocument', e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="bloodType" className={labelCls}>
                  Grupo sanguíneo
                </label>
                <select
                  id="bloodType"
                  value={form.bloodType}
                  onChange={(e) => update('bloodType', e.target.value)}
                  className={inputCls}
                >
                  <option value="">—</option>
                  {BLOOD_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="address" className={labelCls}>
                  Dirección
                </label>
                <input
                  id="address"
                  type="text"
                  value={form.address}
                  onChange={(e) => update('address', e.target.value)}
                  className={inputCls}
                  placeholder="Calle, ciudad, código postal"
                />
              </div>

              <fieldset className="rounded-md border border-outline-variant p-4">
                <legend className="px-1 text-xs font-medium text-on-surface-variant">
                  Contacto de emergencia
                </legend>
                <div className="mt-3 grid gap-4 md:grid-cols-3">
                  <div>
                    <label htmlFor="ecName" className={labelCls}>
                      Nombre
                    </label>
                    <input
                      id="ecName"
                      type="text"
                      value={form.ecName}
                      onChange={(e) => update('ecName', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="ecPhone" className={labelCls}>
                      Teléfono
                    </label>
                    <input
                      id="ecPhone"
                      type="text"
                      value={form.ecPhone}
                      onChange={(e) => update('ecPhone', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="ecRelationship" className={labelCls}>
                      Relación
                    </label>
                    <input
                      id="ecRelationship"
                      type="text"
                      value={form.ecRelationship}
                      onChange={(e) => update('ecRelationship', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
              </fieldset>

              <div>
                <label htmlFor="notes" className={labelCls}>
                  Notas
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => update('notes', e.target.value)}
                  className={inputCls}
                />
              </div>

              {status === 'success' && (
                <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                  Paciente actualizado correctamente.
                </div>
              )}
              {status === 'error' && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  No se pudo actualizar el paciente:{' '}
                  {updateMutation.error?.message ?? 'error desconocido'}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                  disabled={updateMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Guardando…' : 'Guardar cambios'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}