'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreatePatient } from '@/hooks/usePatients';
import type { CreatePatientInput, Sex, IdDocumentType, BloodType } from '@medicore/contracts';

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];

const ID_DOC_TYPE_OPTIONS: { value: IdDocumentType; label: string }[] = [
  { value: 'DNI', label: 'DNI' },
  { value: 'NIE', label: 'NIE' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'OTHER', label: 'Other' },
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
  { value: 'UNKNOWN', label: 'Unknown' },
];

interface DuplicateCandidate {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  nhc: string;
}

export function PatientForm() {
  const router = useRouter();
  const createMutation = useCreatePatient();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    birthDate: '',
    sex: 'MALE' as Sex,
    phone: '',
    email: '',
    idDocument: '',
    idDocType: 'DNI' as IdDocumentType,
    bloodType: 'UNKNOWN' as BloodType,
    notes: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent, confirmDuplicate = false) => {
    e.preventDefault();
    setError(null);
    setDuplicates(null);

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('First and last name are required');
      return;
    }

    if (!form.birthDate) {
      setError('Birth date is required');
      return;
    }

    const payload: CreatePatientInput = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      birthDate: new Date(form.birthDate).toISOString(),
      sex: form.sex,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      idDocument: form.idDocument.trim() || undefined,
      idDocType: form.idDocType,
      bloodType: form.bloodType,
      notes: form.notes.trim() || undefined,
    };

    try {
      const result = await createMutation.mutateAsync({
        input: payload,
        confirmDuplicate,
      });
      router.push(`/patients/${result.id}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        const msg = err.message;
        try {
          const parsed = JSON.parse(msg);
          if (parsed.similarPatients && parsed.confirmRequired) {
            setDuplicates(parsed.similarPatients);
            return;
          }
        } catch {
          const manualCandidates = (err as any).similarPatients;
          if (manualCandidates?.length) {
            setDuplicates(manualCandidates);
            return;
          }
        }
        setError(msg);
      } else {
        setError('Failed to create patient');
      }
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">New Patient</h2>
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={(e) => handleSubmit(e)}>
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-5">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {duplicates && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-800">
                Possible duplicate patients detected:
              </p>
              <ul className="mt-2 space-y-1">
                {duplicates.map((dup) => (
                  <li key={dup.id} className="text-sm text-amber-700">
                    {dup.lastName}, {dup.firstName} — NHC: {dup.nhc} (born {new Date(dup.birthDate).toLocaleDateString()})
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={createMutation.isPending}
                className="mt-3 rounded-md bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Confirming...' : 'Confirm — create anyway'}
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">First Name *</label>
              <input
                type="text"
                required
                value={form.firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Last Name *</label>
              <input
                type="text"
                required
                value={form.lastName}
                onChange={(e) => updateField('lastName', e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Birth Date *</label>
              <input
                type="date"
                required
                value={form.birthDate}
                onChange={(e) => updateField('birthDate', e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Sex *</label>
              <select
                value={form.sex}
                onChange={(e) => updateField('sex', e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              >
                {SEX_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">ID Document</label>
              <input
                type="text"
                value={form.idDocument}
                onChange={(e) => updateField('idDocument', e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Document Type</label>
              <select
                value={form.idDocType}
                onChange={(e) => updateField('idDocType', e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              >
                {ID_DOC_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Blood Type</label>
            <select
              value={form.bloodType}
              onChange={(e) => updateField('bloodType', e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            >
              {BLOOD_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              rows={3}
              placeholder="Clinical notes..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-md border px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Patient'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
