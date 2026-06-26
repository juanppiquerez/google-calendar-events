/** Mirrors backend PAST_START_TOLERANCE_MS. */
export const PAST_START_TOLERANCE_MS = 5_000;

export interface BookingFormInput {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
}

export function validateBookingForm(input: BookingFormInput): string | null {
  const title = input.title.trim();

  if (!title) {
    return 'Title is required';
  }

  if (title.length > 200) {
    return 'Title cannot exceed 200 characters';
  }

  const start = new Date(`${input.date}T${input.startTime}`);
  const end = new Date(`${input.date}T${input.endTime}`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Invalid date or time';
  }

  if (start >= end) {
    return 'End time must be after start time';
  }

  if (start.getTime() < Date.now() - PAST_START_TOLERANCE_MS) {
    return 'Date and time cannot be in the past';
  }

  return null;
}
