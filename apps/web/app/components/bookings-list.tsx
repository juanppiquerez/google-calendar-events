'use client';

import type { Booking } from '@booking/shared-types';
import { BookingStatus } from '@booking/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/app/components/confirm-dialog';
import { ErrorState } from '@/app/components/ui/error-state';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Spinner } from '@/app/components/ui/spinner';
import { getErrorMessage, redirectOnUnauthorized } from '@/lib/api-error';
import { useRedirectOnUnauthorized } from '@/lib/use-redirect-on-unauthorized';
import { BookingsApiError, cancelBooking, fetchBookings } from '@/lib/bookings-client';
import { formatLocalDateTime, isoToLocalDateString } from '@/lib/datetime';

export const BOOKINGS_QUERY_KEY = ['bookings'] as const;

interface BookingsListProps {
  onDateSelect?: (date: string) => void;
}

export function BookingsList({ onDateSelect }: BookingsListProps) {
  const queryClient = useQueryClient();
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);

  const bookingsQuery = useQuery({
    queryKey: BOOKINGS_QUERY_KEY,
    queryFn: () => fetchBookings(),
    meta: { errorMessage: 'Could not load bookings' },
  });

  useRedirectOnUnauthorized(bookingsQuery.error);

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelBooking(id),
    onSuccess: () => {
      setCancelTarget(null);
      toast.success('Booking cancelled successfully');
      void queryClient.invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (error: unknown) => {
      redirectOnUnauthorized(error);
      if (error instanceof BookingsApiError && error.status === 409) {
        toast.error(error.message);
        return;
      }
      toast.error(getErrorMessage(error, 'Could not cancel the booking'));
    },
  });

  function statusLabel(status: BookingStatus) {
    return status === BookingStatus.CONFIRMED ? 'Confirmed' : 'Cancelled';
  }

  return (
    <section
      aria-labelledby="bookings-list-heading"
      className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id="bookings-list-heading" className="text-lg font-semibold text-neutral-900">
          Your bookings
        </h2>
        {bookingsQuery.isFetching && !bookingsQuery.isLoading && (
          <Spinner label="Updating…" />
        )}
      </div>

      {bookingsQuery.isLoading && (
        <div className="mt-4 space-y-3" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      )}

      {bookingsQuery.isError && (
        <div className="mt-4">
          <ErrorState
            error={bookingsQuery.error}
            fallbackMessage="Could not load bookings"
            onRetry={() => void bookingsQuery.refetch()}
          />
        </div>
      )}

      {bookingsQuery.isSuccess && bookingsQuery.data.length === 0 && (
        <p className="mt-4 text-sm text-neutral-600">
          You don&apos;t have any bookings yet. Create one from &quot;New booking&quot;.
        </p>
      )}

      <ul className="mt-4 divide-y divide-neutral-100">
        {bookingsQuery.data?.map((booking) => (
          <li
            key={booking.id}
            className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-neutral-900">{booking.title}</p>
              <button
                type="button"
                onClick={() => onDateSelect?.(isoToLocalDateString(booking.startTime))}
                className="mt-1 text-left text-sm text-neutral-600 hover:text-neutral-900 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
              >
                {formatLocalDateTime(booking.startTime)} –{' '}
                {formatLocalDateTime(booking.endTime).split(', ')[1]}
              </button>
              <p className="mt-1 text-xs text-neutral-500">
                Status: {statusLabel(booking.status)}
              </p>
            </div>

            {booking.status === BookingStatus.CONFIRMED && (
              <button
                type="button"
                onClick={() => setCancelTarget(booking)}
                className="self-start rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                Cancel
              </button>
            )}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancel booking?"
        description={
          cancelTarget
            ? `This will cancel "${cancelTarget.title}" (${formatLocalDateTime(cancelTarget.startTime)}).`
            : ''
        }
        confirmLabel="Confirm cancellation"
        destructive
        isPending={cancelMutation.isPending}
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => {
          if (cancelTarget) {
            cancelMutation.mutate(cancelTarget.id);
          }
        }}
      />
    </section>
  );
}
