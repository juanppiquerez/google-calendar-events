import type { Booking, CreateBookingDto } from '@booking/shared-types';
import { BookingStatus } from '@booking/shared-types';

export class BookingsApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'BookingsApiError';
  }
}

async function parseErrorMessage(response: Response): Promise<string> {
  const text = await response.text();

  try {
    const body = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(body.message)) {
      return body.message.join(', ');
    }
    if (body.message) {
      return body.message;
    }
  } catch {
    // fall through
  }

  return text || response.statusText;
}

export async function fetchBookings(status?: BookingStatus): Promise<Booking[]> {
  const query = status ? `?status=${status}` : '';
  const response = await fetch(`/api/bookings${query}`);

  if (!response.ok) {
    throw new BookingsApiError(
      response.status,
      await parseErrorMessage(response),
    );
  }

  return response.json() as Promise<Booking[]>;
}

export async function createBooking(
  dto: CreateBookingDto,
  idempotencyKey?: string,
): Promise<Booking> {
  const response = await fetch('/api/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) {
    throw new BookingsApiError(
      response.status,
      await parseErrorMessage(response),
    );
  }

  return response.json() as Promise<Booking>;
}

export async function cancelBooking(
  id: string,
): Promise<{ message: string; booking: Booking }> {
  const response = await fetch(`/api/bookings/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new BookingsApiError(
      response.status,
      await parseErrorMessage(response),
    );
  }

  return response.json() as Promise<{ message: string; booking: Booking }>;
}
