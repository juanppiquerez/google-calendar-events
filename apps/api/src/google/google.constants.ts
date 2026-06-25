/** Minimum scope for calendar.freebusy.query — see README for justification. */
export const GOOGLE_CALENDAR_FREEBUSY_SCOPE =
  'https://www.googleapis.com/auth/calendar.freebusy';

/** List subscribed calendars (IDs only) so freebusy covers all visible calendars. */
export const GOOGLE_CALENDAR_LIST_READONLY_SCOPE =
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly';

/** Scopes requested during Google OAuth connect. */
export const GOOGLE_OAUTH_SCOPES = [
  GOOGLE_CALENDAR_FREEBUSY_SCOPE,
  GOOGLE_CALENDAR_LIST_READONLY_SCOPE,
] as const;

/** Space-delimited scope string stored on GoogleToken rows. */
export const GOOGLE_CALENDAR_SCOPE = GOOGLE_OAUTH_SCOPES.join(' ');

export const GOOGLE_CALENDAR_CONFLICT_MESSAGE =
  'El horario conflictúa con un evento en tu Google Calendar';

/** Refresh access token when expiry is within this window. */
export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1_000;

export const GOOGLE_API_MAX_RETRIES = 3;
export const GOOGLE_API_INITIAL_BACKOFF_MS = 500;
