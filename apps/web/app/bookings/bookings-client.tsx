'use client';

import type { Booking } from '@booking/shared-types';
import { BookingStatus } from '@booking/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  BookingsApiError,
  cancelBooking,
  createBooking,
  fetchBookings,
} from '@/lib/bookings-client';
import {
  formatLocalDateTime,
  getLocalTimeZoneLabel,
  toUtcIsoFromLocal,
} from '@/lib/datetime';

const BOOKINGS_QUERY_KEY = ['bookings'] as const;

function defaultDateValue() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

export function BookingsClient() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultDateValue);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [formError, setFormError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);

  const bookingsQuery = useQuery({
    queryKey: BOOKINGS_QUERY_KEY,
    queryFn: () => fetchBookings(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createBooking({
        title: title.trim(),
        startTime: toUtcIsoFromLocal(date, startTime),
        endTime: toUtcIsoFromLocal(date, endTime),
      }),
    onSuccess: () => {
      setFormError(null);
      setTitle('');
      void queryClient.invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY });
    },
    onError: (error: unknown) => {
      if (error instanceof BookingsApiError && error.status === 409) {
        setFormError(error.message);
        return;
      }
      setFormError(
        error instanceof Error ? error.message : 'No se pudo crear la reserva',
      );
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelBooking(id),
    onSuccess: () => {
      setCancelTarget(null);
      void queryClient.invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY });
    },
  });

  const timeZone = getLocalTimeZoneLabel();

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    createMutation.mutate();
  }

  function statusLabel(status: BookingStatus) {
    return status === BookingStatus.CONFIRMED ? 'Confirmada' : 'Cancelada';
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Mis reservas</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Las fechas se muestran en tu zona horaria local ({timeZone}). Internamente
          se almacenan y procesan en UTC.
        </p>
      </header>

      <section className="rounded-lg border border-neutral-200 p-6">
        <h2 className="text-lg font-medium">Nueva reserva</h2>
        <form onSubmit={handleCreate} className="mt-4 space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm text-neutral-600">
              Título
            </label>
            <input
              id="title"
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              placeholder="Reunión de equipo"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="date" className="block text-sm text-neutral-600">
                Fecha
              </label>
              <input
                id="date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="startTime"
                className="block text-sm text-neutral-600"
              >
                Hora inicio
              </label>
              <input
                id="startTime"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="endTime" className="block text-sm text-neutral-600">
                Hora fin
              </label>
              <input
                id="endTime"
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {formError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creando…' : 'Crear reserva'}
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-neutral-200 p-6">
        <h2 className="text-lg font-medium">Reservas</h2>

        {bookingsQuery.isLoading && (
          <p className="mt-4 text-sm text-neutral-500">Cargando reservas…</p>
        )}

        {bookingsQuery.isError && (
          <p className="mt-4 text-sm text-red-600">
            No se pudieron cargar las reservas.
          </p>
        )}

        {bookingsQuery.data?.length === 0 && (
          <p className="mt-4 text-sm text-neutral-500">
            Todavía no tenés reservas.
          </p>
        )}

        <ul className="mt-4 divide-y divide-neutral-100">
          {bookingsQuery.data?.map((booking) => (
            <li
              key={booking.id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{booking.title}</p>
                <p className="mt-1 text-sm text-neutral-600">
                  {formatLocalDateTime(booking.startTime)} –{' '}
                  {formatLocalDateTime(booking.endTime).split(', ')[1]}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Estado: {statusLabel(booking.status)}
                </p>
              </div>

              {booking.status === BookingStatus.CONFIRMED && (
                <button
                  type="button"
                  onClick={() => setCancelTarget(booking)}
                  className="self-start rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                >
                  Cancelar
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-dialog-title"
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg"
          >
            <h3 id="cancel-dialog-title" className="text-lg font-medium">
              ¿Cancelar reserva?
            </h3>
            <p className="mt-2 text-sm text-neutral-600">
              Se cancelará &quot;{cancelTarget.title}&quot; (
              {formatLocalDateTime(cancelTarget.startTime)}).
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate(cancelTarget.id)}
                className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {cancelMutation.isPending ? 'Cancelando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
