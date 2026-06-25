export enum BookingStatus {
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

export interface User {
  id: string;
  auth0Id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  userId: string;
  title: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookingDto {
  title: string;
  startTime: string;
  endTime: string;
}

export interface UpdateBookingDto {
  title?: string;
  startTime?: string;
  endTime?: string;
  status?: BookingStatus;
}

export type OccupiedSlotSource = 'booking' | 'google_calendar';

export interface OccupiedSlot {
  startTime: string;
  endTime: string;
  source: OccupiedSlotSource;
  bookingId?: string;
  title?: string;
}

export interface AvailabilityResponse {
  date: string;
  timeZone: string;
  dayStart: string;
  dayEnd: string;
  occupiedSlots: OccupiedSlot[];
  googleCalendarConnected: boolean;
  googleCalendarSyncError?: string;
}
