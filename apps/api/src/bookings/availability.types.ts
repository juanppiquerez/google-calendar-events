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
