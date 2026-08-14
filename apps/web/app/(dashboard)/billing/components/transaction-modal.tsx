'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  useCreateBillingTransaction,
  useUpdateBillingTransaction,
  type BillingTransaction,
  type BillingType,
  type BillingStatus,
} from '@/hooks/useBilling';

const TYPE_OPTIONS: BillingType[] = ['CONSULTATION', 'SURGERY', 'TREATMENT', 'SUBSCRIPTION', 'OTHER'];
const STATUS_OPTIONS: BillingStatus[] = ['PENDING', 'PAID', 'CANCELLED', 'REFUNDED'];

function formatEnum(key: string): string {
  return key
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface TransactionModalProps {
  open: boolean;
  onClose: () => void;
  /** When provided the modal acts as edit; otherwise create. */
  transaction?: BillingTransaction | null;
  onMutated?: () => void;
}

interface FormState {
  amount: string;
  type: BillingType;
  status: BillingStatus;
  description: string;
}

function fromTransaction(t: BillingTransaction | null | undefined): FormState {
  return {
    amount: t ? String(t.amount) : '',
    type: t?.type ?? 'CONSULTATION',
    status: t?.status ?? 'PENDING',
    description: t?.description ?? '',
  };
}

/** Create / edit billing transaction modal. Plain React state + zod-free validation
 *  (the codebase has no react-hook-form dependency; keeping this self-contained). */
export function TransactionModal({ open, onClose, transaction, onMutated }: TransactionModalProps) {
  const isEdit = Boolean(transaction);
  const [form, setForm] = useState<FormState>(() => fromTransaction(transaction));
  const [error, setError] = useState<string | null>(null);

  // Re-sync form when the target transaction changes (open switch from create to edit).
  useEffect(() => {
    if (open) {
      setForm(fromTransaction(transaction));
      setError(null);
    }
  }, [open, transaction]);

  const createMutation = useCreateBillingTransaction();
  const updateMutation = useUpdateBillingTransaction();
  const pending = createMutation.isPending || updateMutation.isPending;

  if (!open) return null;

  function validate(): string | null {
    const amount = Number(form.amount);
    if (!form.amount.trim()) return 'El importe es obligatorio';
    if (Number.isNaN(amount) || amount < 0) return 'El importe debe ser un número ≥ 0';
    if (form.description.length > 2000) return 'La descripción no puede superar 2000 caracteres';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      amount: Number(form.amount),
      type: form.type,
      status: form.status,
      description: form.description.trim() || null,
    };

    try {
      if (isEdit && transaction) {
        await updateMutation.mutateAsync({ id: transaction.id, patch: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onMutated?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando la transacción');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transaction-modal-title"
    >
      <div className="w-full max-w-md rounded-lg border border-outline-variant bg-surface-lowest p-6 shadow-card">
        <h2 id="transaction-modal-title" className="mb-4 text-lg font-semibold text-on-surface">
          {isEdit ? 'Editar transacción' : 'Nueva transacción'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm text-on-surface-variant">
            Importe (€)
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="mt-1 w-full rounded border border-outline bg-surface-low px-3 py-2 text-sm text-on-surface"
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm text-on-surface-variant">
              Tipo
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as BillingType }))}
                className="mt-1 w-full rounded border border-outline bg-surface-low px-2 py-2 text-sm text-on-surface"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{formatEnum(t)}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-on-surface-variant">
              Estado
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as BillingStatus }))}
                className="mt-1 w-full rounded border border-outline bg-surface-low px-2 py-2 text-sm text-on-surface"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{formatEnum(s)}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm text-on-surface-variant">
            Descripción
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              maxLength={2000}
              className="mt-1 w-full rounded border border-outline bg-surface-low px-3 py-2 text-sm text-on-surface"
            />
          </label>

          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}