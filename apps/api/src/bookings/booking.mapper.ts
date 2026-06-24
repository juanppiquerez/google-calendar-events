import { Booking } from '@prisma/client';

export interface BookingResponse {
  id: string;
  userId: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function toBookingResponse(booking: Booking): BookingResponse {
  return {
    id: booking.id,
    userId: booking.userId,
    title: booking.title,
    startTime: booking.startTime.toISOString(),
    endTime: booking.endTime.toISOString(),
    status: booking.status,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
}
