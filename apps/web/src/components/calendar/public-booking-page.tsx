'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface Slot {
  date: string;
  startTime: string;
  endTime: string;
}

export function PublicBookingPage() {
  const params = useParams<{ userId: string }>();
  const userId = params?.userId ?? '';

  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState<string | null>(null);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/v1/calendar/${userId}/public/slots`);
      if (!res.ok) throw new Error('Error cargando horarios');
      const data = await res.json();
      setSlots(data.slots ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) loadSlots();
  }, [userId, loadSlots]);

  async function handleBook() {
    if (!selectedSlot || !name || !email) return;
    setBooking(true);
    setError(null);
    try {
      const res = await fetch(`/v1/calendar/${userId}/public/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          reason: reason || undefined,
          slotDate: selectedSlot.date,
          slotStart: selectedSlot.startTime,
          slotEnd: selectedSlot.endTime,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? 'Error al reservar');
      }
      const data = await res.json();
      setBooked(data.message ?? 'Reserva confirmada');
      setSelectedSlot(null);
      setName('');
      setEmail('');
      setReason('');
      await loadSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBooking(false);
    }
  }

  const slotsByDate = new Map<string, Slot[]>();
  for (const s of slots) {
    const existing = slotsByDate.get(s.date) ?? [];
    existing.push(s);
    slotsByDate.set(s.date, existing);
  }

  return (
    <div className="min-h-screen bg-[#0D1117]">
      <div className="container mx-auto max-w-2xl px-4 py-16">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-on-surface">Reservar cita</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Selecciona un horario disponible y completa tus datos. El médico confirmará la reserva.
          </p>
        </div>

        {booked && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-300 mb-6">
            {booked}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300 mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-sm text-on-surface-variant/60 py-12">Cargando horarios…</div>
        ) : slots.length === 0 ? (
          <div className="rounded-lg border border-outline-variant bg-surface-lowest p-12 text-center">
            <p className="text-on-surface-variant">No hay horarios disponibles en este momento.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Date groups */}
            {[...slotsByDate.entries()].map(([date, dateSlots]) => (
              <div key={date} className="rounded-lg border border-outline-variant bg-surface-lowest p-4">
                <h2 className="text-sm font-semibold text-on-surface mb-3">
                  {new Date(date + 'T00:00:00').toLocaleDateString('es-ES', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {dateSlots.map((slot) => {
                    const isSelected =
                      selectedSlot?.date === slot.date &&
                      selectedSlot?.startTime === slot.startTime;
                    return (
                      <button
                        key={`${slot.date}-${slot.startTime}`}
                        onClick={() => setSelectedSlot(slot)}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                          isSelected
                            ? 'bg-aqua-500/20 text-aqua-400 border border-aqua-500/40'
                            : 'border border-outline-variant text-on-surface-variant hover:border-aqua-500/40 hover:text-on-surface'
                        }`}
                      >
                        {slot.startTime} – {slot.endTime}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Booking form */}
            {selectedSlot && (
              <div className="rounded-lg border border-outline-variant bg-surface-lowest p-6 space-y-4">
                <h3 className="text-sm font-semibold text-on-surface">
                  Reservar:{' '}
                  {new Date(selectedSlot.date + 'T00:00:00').toLocaleDateString('es-ES')}{' '}
                  {selectedSlot.startTime} – {selectedSlot.endTime}
                </h3>

                <label className="block text-sm text-on-surface-variant">
                  Nombre
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded border border-outline bg-surface-low px-3 py-2 text-sm text-on-surface"
                    required
                  />
                </label>
                <label className="block text-sm text-on-surface-variant">
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded border border-outline bg-surface-low px-3 py-2 text-sm text-on-surface"
                    required
                  />
                </label>
                <label className="block text-sm text-on-surface-variant">
                  Motivo (opcional)
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded border border-outline bg-surface-low px-3 py-2 text-sm text-on-surface"
                  />
                </label>

                <Button onClick={handleBook} disabled={booking || !name || !email}>
                  {booking ? 'Reservando…' : 'Confirmar reserva'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
