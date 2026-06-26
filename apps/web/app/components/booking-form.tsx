'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { AvailabilityGrid } from '@/app/components/availability-grid';
import { ErrorState } from '@/app/components/ui/error-state';
import { BOOKINGS_QUERY_KEY } from '@/app/components/bookings-list';
import { getErrorMessage, isConflictError, redirectOnUnauthorized } from '@/lib/api-error';
import { useRedirectOnUnauthorized } from '@/lib/use-redirect-on-unauthorized';
import { validateBookingForm } from '@/lib/booking-validation';
import {
  BookingsApiError,
  createBooking,
  fetchAvailability,
} from '@/lib/bookings-client';
import { getLocalTimeZoneLabel, toUtcIsoFromLocal } from '@/lib/datetime';

const GOOGLE_CALENDAR_CONFLICT_HINT = 'Google Calendar';

function isGoogleCalendarConflict(message: string): boolean {
  return message.includes(GOOGLE_CALENDAR_CONFLICT_HINT);
}

function defaultDateValue() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

export function BookingForm() {
  const queryClient = useQueryClient();
  const timeZone = getLocalTimeZoneLabel();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultDateValue);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [clientError, setClientError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const availabilityQuery = useQuery({
    queryKey: ['availability', date, timeZone],
    queryFn: () => fetchAvailability(date, timeZone),
    enabled: Boolean(date),
  });

  useRedirectOnUnauthorized(availabilityQuery.error);

  const createMutation = useMutation({
    mutationFn: () =>
      createBooking({
        title: title.trim(),
        startTime: toUtcIsoFromLocal(date, startTime),
        endTime: toUtcIsoFromLocal(date, endTime),
      }),
    onSuccess: () => {
      setServerError(null);
      setClientError(null);
      setTitle('');
      toast.success('Booking created successfully');
      void queryClient.invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (error: unknown) => {
      redirectOnUnauthorized(error);
      if (error instanceof BookingsApiError && error.status === 409) {
        setServerError(error.message);
        toast.error(error.message);
        return;
      }
      const message = getErrorMessage(error, 'Could not create the booking');
      setServerError(message);
      toast.error(message);
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setClientError(null);
    setServerError(null);

    const validationError = validateBookingForm({
      title,
      date,
      startTime,
      endTime,
    });

    if (validationError) {
      setClientError(validationError);
      return;
    }

    createMutation.mutate();
  }

  const displayError = clientError ?? serverError;

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="new-booking-heading"
        className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <h2 id="new-booking-heading" className="text-lg font-semibold text-neutral-900">
          New booking
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Times shown in your local timezone ({timeZone}). Final validation is performed by the
          server.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-neutral-700">
              Title
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
              placeholder="Team meeting"
              aria-invalid={clientError?.includes('title') ? true : undefined}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-neutral-700">
                Date
              </label>
              <input
                id="date"
                name="date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
              />
            </div>
            <div>
              <label
                htmlFor="startTime"
                className="block text-sm font-medium text-neutral-700"
              >
                Start time
              </label>
              <input
                id="startTime"
                name="startTime"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
              />
            </div>
            <div>
              <label htmlFor="endTime" className="block text-sm font-medium text-neutral-700">
                End time
              </label>
              <input
                id="endTime"
                name="endTime"
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
              />
            </div>
          </div>

          {displayError && (
            <p
              role="alert"
              className={`rounded-md px-3 py-2 text-sm ${
                serverError && isGoogleCalendarConflict(serverError)
                  ? 'border border-amber-200 bg-amber-50 text-amber-900'
                  : clientError
                    ? 'border border-red-200 bg-red-50 text-red-800'
                    : isConflictError(displayError)
                      ? 'border border-amber-200 bg-amber-50 text-amber-900'
                      : 'border border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {serverError && isGoogleCalendarConflict(serverError) ? (
                <>
                  <span className="font-medium">Google Calendar conflict:</span>{' '}
                  {serverError}
                </>
              ) : clientError ? (
                displayError
              ) : isConflictError(displayError) ? (
                <>
                  <span className="font-medium">Schedule conflict:</span>{' '}
                  {displayError}
                </>
              ) : (
                displayError
              )}
            </p>
          )}

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating…' : 'Create booking'}
          </button>
        </form>
      </section>

      <section
        aria-labelledby="availability-preview-heading"
        className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              id="availability-preview-heading"
              className="text-lg font-semibold text-neutral-900"
            >
              Day availability
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              30-minute slots between 07:00 and 21:00
            </p>
          </div>
          <label htmlFor="availability-date" className="sr-only">
            Date to view availability
          </label>
          <input
            id="availability-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          />
        </div>

        {availabilityQuery.isError && (
          <div className="mt-4">
            <ErrorState
              error={availabilityQuery.error}
              fallbackMessage="Could not load availability"
              onRetry={() => void availabilityQuery.refetch()}
            />
          </div>
        )}

        <div className="mt-4">
          <AvailabilityGrid
            date={date}
            timeZone={timeZone}
            occupiedSlots={availabilityQuery.data?.occupiedSlots ?? []}
            isLoading={availabilityQuery.isLoading}
            isFetching={availabilityQuery.isFetching && !availabilityQuery.isLoading}
          />
        </div>

        {availabilityQuery.data?.googleCalendarSyncError && (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {availabilityQuery.data.googleCalendarSyncError}
          </p>
        )}

        {availabilityQuery.data && !availabilityQuery.data.googleCalendarConnected && (
          <p className="mt-4 text-xs text-neutral-500">
            Google Calendar is not connected: only internal bookings are shown.
          </p>
        )}
      </section>
    </div>
  );
}
