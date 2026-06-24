/** Minimum scope for calendar.freebusy.query — see README for justification. */
export const GOOGLE_CALENDAR_SCOPE =
  'https://www.googleapis.com/auth/calendar.freebusy';

export const GOOGLE_CALENDAR_CONFLICT_MESSAGE =
  'El horario conflictúa con un evento en tu Google Calendar';

/** Refresh access token when expiry is within this window. */
export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1_000;

export const GOOGLE_API_MAX_RETRIES = 3;
export const GOOGLE_API_INITIAL_BACKOFF_MS = 500;
