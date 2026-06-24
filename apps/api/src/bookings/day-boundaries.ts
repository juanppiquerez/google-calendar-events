import { fromZonedTime } from 'date-fns-tz';

/** Calendar-day bounds in the given IANA timezone, returned as UTC instants. */
export function getDayBoundaries(
  date: string,
  timeZone: string,
): { dayStart: Date; dayEnd: Date } {
  const dayStart = fromZonedTime(`${date}T00:00:00.000`, timeZone);
  const dayEnd = fromZonedTime(`${date}T23:59:59.999`, timeZone);
  return { dayStart, dayEnd };
}
