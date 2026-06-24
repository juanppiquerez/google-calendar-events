import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';

const DISPLAY_FORMAT = "EEE d MMM yyyy, HH:mm";

export function formatLocalDateTime(isoUtc: string): string {
  const date = new Date(isoUtc);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return formatInTimeZone(date, timeZone, DISPLAY_FORMAT, { locale: es });
}

export function getLocalTimeZoneLabel(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function toUtcIsoFromLocal(date: string, time: string): string {
  const local = new Date(`${date}T${time}`);
  return local.toISOString();
}

/** Local calendar date (YYYY-MM-DD) for an ISO UTC instant. */
export function isoToLocalDateString(isoUtc: string): string {
  const date = new Date(isoUtc);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
