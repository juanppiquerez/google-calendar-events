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
