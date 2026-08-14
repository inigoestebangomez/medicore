'use client';

import { useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  useCalendarEvents,
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
} from '@/hooks/useCalendarEvents';
import type { CalendarEventView } from '@medicore/contracts';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number): number {
  // 0 = Sunday → map to 1 = Monday
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function toISODate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function eventColor(source: string): string {
  switch (source) {
    case 'SURGERY': return 'bg-red-500';
    case 'CONSULTATION': return 'bg-blue-500';
    case 'PHARMA_INTERACTION': return 'bg-purple-500';
    case 'MANUAL': return 'bg-aqua-500';
    case 'PUBLIC_BOOKING': return 'bg-yellow-500';
    case 'EXTERNAL_GOOGLE': return 'bg-green-500';
    case 'EXTERNAL_MICROSOFT': return 'bg-orange-500';
    case 'EXTERNAL_ICLOUD': return 'bg-gray-400';
    default: return 'bg-clinical-draft';
  }
}

// ─────────────────────────────────────────────
// Event Modal (create/edit)
// ─────────────────────────────────────────────

function EventModal({
  open,
  onClose,
  event,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  event: CalendarEventView | null;
  defaultDate?: string;
}) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [startDate, setStartDate] = useState(
    event?.startDateTime?.split('T')[0] ?? defaultDate ?? '',
  );
  const [endDate, setEndDate] = useState(
    event?.endDateTime?.split('T')[0] ?? defaultDate ?? '',
  );
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateCalendarEvent();
  const updateMutation = useUpdateCalendarEvent();

  if (!open) return null;

  const pending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      if (event) {
        await updateMutation.mutateAsync({
          id: event.id,
          title,
          description: description || null,
          startDateTime: new Date(startDate).toISOString(),
          endDateTime: new Date(endDate).toISOString(),
        });
      } else {
        await createMutation.mutateAsync({
          title,
          description,
          startDateTime: new Date(startDate).toISOString(),
          endDateTime: new Date(endDate).toISOString(),
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-lg border border-outline-variant bg-surface-lowest p-6 shadow-card">
        <h2 className="mb-4 text-lg font-semibold text-on-surface">
          {event ? 'Editar evento' : 'Nuevo evento'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm text-on-surface-variant">
            Título
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded border border-outline bg-surface-low px-3 py-2 text-sm text-on-surface"
              required
            />
          </label>
          <label className="block text-sm text-on-surface-variant">
            Descripción
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded border border-outline bg-surface-low px-3 py-2 text-sm text-on-surface"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm text-on-surface-variant">
              Inicio
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded border border-outline bg-surface-low px-2 py-2 text-sm text-on-surface"
                required
              />
            </label>
            <label className="block text-sm text-on-surface-variant">
              Fin
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded border border-outline bg-surface-low px-2 py-2 text-sm text-on-surface"
                required
              />
            </label>
          </div>
          {error && <p className="text-sm text-clinical-critical">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando…' : event ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Day Cell
// ─────────────────────────────────────────────

function DayCell({
  day,
  events,
  isToday,
  isCurrentMonth,
  onClick,
}: {
  day: number | null;
  events: CalendarEventView[];
  isToday: boolean;
  isCurrentMonth: boolean;
  onClick: () => void;
}) {
  if (day === null) {
    return <div className="min-h-[80px] rounded-lg bg-surface-low" />;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[80px] rounded-lg border p-1.5 text-left transition-colors hover:bg-surface-low ${
        isCurrentMonth
          ? 'border-outline-variant bg-surface-lowest'
          : 'border-outline-variant bg-surface-low'
      } ${isToday ? 'border-aqua-500/40 bg-aqua-500/5' : ''}`}
    >
      <span
        className={`text-xs font-medium ${
          isCurrentMonth ? 'text-on-surface' : 'text-on-surface-variant/40'
        } ${isToday ? 'text-aqua-400' : ''}`}
      >
        {day}
      </span>
      <div className="mt-1 space-y-0.5">
        {events.slice(0, 3).map((ev) => (
          <div
            key={ev.id}
            className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight truncate ${
              ev.source === 'MANUAL' || ev.source.startsWith('EXTERNAL')
                ? 'bg-surface-low text-on-surface-variant'
                : 'text-on-surface-variant'
            }`}
          >
            <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${eventColor(ev.source)}`} />
            <span className="truncate">{ev.title}</span>
          </div>
        ))}
        {events.length > 3 && (
          <span className="text-[10px] text-on-surface-variant/60">
            +{events.length - 3} más
          </span>
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────
// Expanded Day Panel
// ─────────────────────────────────────────────

function ExpandedDay({
  date,
  events,
  onClose,
  onEdit,
  onDelete,
}: {
  date: string;
  events: CalendarEventView[];
  onClose: () => void;
  onEdit: (ev: CalendarEventView) => void;
  onDelete: (id: string) => void;
}) {
  const deleteMutation = useDeleteCalendarEvent();
  const [deleting, setDeleting] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-outline-variant bg-surface-lowest p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-on-surface">
          {new Date(date).toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </h3>
        <button onClick={onClose} className="text-xs text-on-surface-variant hover:text-on-surface">
          Cerrar
        </button>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-on-surface-variant/60">Sin eventos</p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="flex items-start gap-3 rounded border border-outline-variant bg-surface-low p-3"
            >
              <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${eventColor(ev.source)}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {ev.link ? (
                    <Link
                      href={ev.link}
                      className="text-sm font-medium text-on-surface hover:text-secondary truncate"
                    >
                      {ev.title}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-on-surface truncate">{ev.title}</span>
                  )}
                  <span className="text-[10px] text-on-surface-variant uppercase shrink-0">
                    {ev.source.replace('_', ' ')}
                  </span>
                </div>
                {ev.description && (
                  <p className="mt-0.5 text-xs text-on-surface-variant line-clamp-2">
                    {ev.description}
                  </p>
                )}
                {ev.patientName && (
                  <p className="mt-0.5 text-xs text-on-surface-variant/60">{ev.patientName}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                {(ev.source === 'MANUAL' || ev.source.startsWith('EXTERNAL')) && (
                  <>
                    <button
                      onClick={() => onEdit(ev)}
                      className="text-xs text-secondary hover:opacity-80"
                    >
                      Editar
                    </button>
                    <button
                      onClick={async () => {
                        setDeleting(ev.id);
                        await deleteMutation.mutateAsync(ev.id);
                        onDelete(ev.id);
                      }}
                      disabled={deleting === ev.id}
                      className="text-xs text-clinical-critical hover:opacity-80"
                    >
                      {deleting === ev.id ? '...' : 'Eliminar'}
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Calendar View
// ─────────────────────────────────────────────

export function CalendarView() {
  const { data: session } = useSession();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventView | null>(null);

  const from = useMemo(() => {
    const d = new Date(year, month, 1);
    d.setDate(d.getDate() - 7); // include overflow from prev month
    return d.toISOString();
  }, [year, month]);

  const to = useMemo(() => {
    const d = new Date(year, month + 1, 0);
    d.setDate(d.getDate() + 7); // include overflow into next month
    return d.toISOString();
  }, [year, month]);

  const { data: events = [], isLoading } = useCalendarEvents(from, to);

  const days = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEventView[]> = {};
    for (const ev of events) {
      const dateKey = ev.startDateTime.split('T')[0];
      (map[dateKey] ??= []).push(ev);
    }
    return map;
  }, [events]);

  const selectedEvents = selectedDate ? eventsByDate[selectedDate] ?? [] : [];

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
    setSelectedDate(null);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
    setSelectedDate(null);
  }
  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDate(null);
  }

  function openCreate(defaultDate?: string) {
    setEditingEvent(null);
    if (defaultDate) setSelectedDate(defaultDate);
    setModalOpen(true);
  }

  function openEdit(ev: CalendarEventView) {
    setEditingEvent(ev);
    setModalOpen(true);
  }

  // Build calendar grid
  const weeks: (number | null)[][] = [];
  let day = 1;
  for (let w = 0; w < 6; w++) {
    const week: (number | null)[] = [];
    for (let d = 0; d < 7; d++) {
      if (w === 0 && d < startDay) {
        week.push(null);
      } else if (day > days) {
        week.push(null);
      } else {
        week.push(day++);
      }
    }
    weeks.push(week);
    if (day > days) break;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-on-surface">Agenda</h1>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="rounded p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-low">
              ‹
            </button>
            <span className="text-sm font-medium text-on-surface min-w-[120px] text-center">
              {MONTH_NAMES[month]} {year}
            </span>
            <button onClick={nextMonth} className="rounded p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-low">
              ›
            </button>
          </div>
          <button onClick={goToday} className="text-xs text-secondary hover:opacity-80">
            Hoy
          </button>
        </div>
        <Button onClick={() => openCreate()} size="sm">
          Nuevo evento
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-on-surface-variant">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Cirugías</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> Consultas</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-purple-500" /> Farma</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-aqua-500" /> Manual</span>
      </div>

      {/* Calendar grid */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-sm text-on-surface-variant/60">Cargando…</div>
      ) : (
        <div className="rounded-lg border border-outline-variant bg-surface-lowest p-3">
          {/* Day names */}
          <div className="grid grid-cols-7 mb-2">
            {DAY_NAMES.map((name) => (
              <div key={name} className="text-center text-xs font-medium text-on-surface-variant py-1">
                {name}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((dayNum, di) => {
                if (dayNum === null) return <DayCell key={di} day={null} events={[]} isToday={false} isCurrentMonth={false} onClick={() => {}} />;

                const dateStr = toISODate(year, month, dayNum);
                const isToday =
                  dayNum === today.getDate() &&
                  month === today.getMonth() &&
                  year === today.getFullYear();

                return (
                  <DayCell
                    key={di}
                    day={dayNum}
                    events={eventsByDate[dateStr] ?? []}
                    isToday={isToday}
                    isCurrentMonth
                    onClick={() => setSelectedDate(dateStr)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Expanded day panel */}
      {selectedDate && (
        <ExpandedDay
          date={selectedDate}
          events={selectedEvents}
          onClose={() => setSelectedDate(null)}
          onEdit={openEdit}
          onDelete={() => {}}
        />
      )}

      {/* Create/Edit Modal */}
      <EventModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingEvent(null); }}
        event={editingEvent}
        defaultDate={selectedDate ?? undefined}
      />

      {/* Shareable booking link */}
      {session?.user && (
        <div className="rounded-lg border border-outline-variant bg-surface-lowest p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-on-surface">Enlace de reserva pública</h3>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                Comparte este enlace para que los pacientes reserven en tus horas disponibles.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className="rounded bg-surface-low px-3 py-1.5 text-xs text-secondary">
                /book/{(session.user as any).id ?? (session.user as any).sub}
              </code>
              <button
                onClick={() => {
                  const userId = (session.user as any).id ?? (session.user as any).sub;
                  navigator.clipboard.writeText(
                    `${window.location.origin}/book/${userId}`,
                  );
                }}
                className="rounded p-1.5 text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-low"
                title="Copiar enlace"
              >
                📋
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
