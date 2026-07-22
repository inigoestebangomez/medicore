'use client';

import { useSchedule } from '@/hooks/useSchedule';

// 0 = Monday (Lunes) — European/Spanish convention.
const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

interface Slot {
  startTime: string;
  endTime: string;
  slotDuration: number;
}

export function ScheduleGrid() {
  const { data, isLoading, error } = useSchedule();

  const byDay: Record<number, Slot[]> = {};
  if (data) {
    for (const item of data.items) {
      (byDay[item.dayOfWeek] ??= []).push({
        startTime: item.startTime,
        endTime: item.endTime,
        slotDuration: item.slotDuration,
      });
    }
  }

  function timeSlotsFor(slot: Slot): string[] {
    const [sh, sm] = slot.startTime.split(':').map(Number);
    const [eh, em] = slot.endTime.split(':').map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    const out: string[] = [];
    for (let t = start; t < end; t += slot.slotDuration) {
      const h = Math.floor(t / 60);
      const m = t % 60;
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
    return out;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-on-surface">Agenda semanal</h2>

      {isLoading && <p className="text-sm text-on-surface-variant/60">Cargando…</p>}
      {error && <p className="text-sm text-red-500">Error: {error.message}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {DAYS.map((label, dayIdx) => {
          const slots = byDay[dayIdx] ?? [];
          const allSlots = slots.flatMap(timeSlotsFor);
          return (
            <div key={dayIdx} className="rounded-lg border border-outline-variant bg-surface-lowest p-3">
              <div className="mb-2 text-sm font-semibold text-on-surface-variant">{label}</div>
              {allSlots.length === 0 ? (
                <div className="text-xs text-gray-300">Sin horas</div>
              ) : (
                <ul className="space-y-1">
                  {allSlots.map((t) => (
                    <li key={t} className="rounded bg-secondary-container/20 px-2 py-1 text-xs text-blue-700">{t}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}