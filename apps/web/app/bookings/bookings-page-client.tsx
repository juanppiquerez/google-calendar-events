'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AvailabilityGrid } from '@/app/components/availability-grid';
import { BookingsList } from '@/app/components/bookings-list';
import { ErrorState } from '@/app/components/ui/error-state';
import { useRedirectOnUnauthorized } from '@/lib/use-redirect-on-unauthorized';
import { fetchAvailability } from '@/lib/bookings-client';
import { getLocalTimeZoneLabel } from '@/lib/datetime';

function defaultDateValue() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

export function BookingsPageClient() {
  const timeZone = getLocalTimeZoneLabel();
  const [selectedDate, setSelectedDate] = useState(defaultDateValue);

  const availabilityQuery = useQuery({
    queryKey: ['availability', selectedDate, timeZone],
    queryFn: () => fetchAvailability(selectedDate, timeZone),
    enabled: Boolean(selectedDate),
  });

  useRedirectOnUnauthorized(availabilityQuery.error);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
          My bookings
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          View your schedule and time availability for the selected day.
        </p>
      </header>

      <section
        aria-labelledby="day-availability-heading"
        className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3
              id="day-availability-heading"
              className="text-lg font-semibold text-neutral-900"
            >
              Day availability
            </h3>
            <p className="mt-1 text-sm text-neutral-600">
              Times in {timeZone} · 30-minute slots
            </p>
          </div>
          <div>
            <label htmlFor="selected-date" className="block text-sm font-medium text-neutral-700">
              Date
            </label>
            <input
              id="selected-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="mt-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            />
          </div>
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
            date={selectedDate}
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
            Connect Google Calendar from the dashboard to also see external events.
          </p>
        )}
      </section>

      <BookingsList onDateSelect={setSelectedDate} />
    </div>
  );
}
