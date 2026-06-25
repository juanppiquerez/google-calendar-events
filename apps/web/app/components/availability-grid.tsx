'use client';

import type { OccupiedSlot, OccupiedSlotSource } from '@booking/shared-types';
import { fromZonedTime } from 'date-fns-tz';
import { useMemo } from 'react';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Spinner } from '@/app/components/ui/spinner';

const SLOT_MINUTES = 30;
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 21;

interface SlotInfo {
  label: string;
  start: Date;
  end: Date;
  status: 'available' | 'booking' | 'google_calendar' | 'both';
}

function buildSlots(
  date: string,
  timeZone: string,
): Array<{ label: string; start: Date; end: Date }> {
  const slots: Array<{ label: string; start: Date; end: Date }> = [];

  for (let hour = DAY_START_HOUR; hour < DAY_END_HOUR; hour++) {
    for (const minute of [0, 30]) {
      const startLabel = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      const endMinutes = hour * 60 + minute + SLOT_MINUTES;
      const endHour = Math.floor(endMinutes / 60);
      const endMinute = endMinutes % 60;
      const endLabel = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

      slots.push({
        label: `${startLabel} – ${endLabel}`,
        start: fromZonedTime(`${date}T${startLabel}:00`, timeZone),
        end: fromZonedTime(`${date}T${endLabel}:00`, timeZone),
      });
    }
  }

  return slots;
}

function overlaps(
  slotStart: Date,
  slotEnd: Date,
  occupiedStart: Date,
  occupiedEnd: Date,
): boolean {
  return occupiedStart < slotEnd && occupiedEnd > slotStart;
}

function resolveSlotStatus(
  slotStart: Date,
  slotEnd: Date,
  occupiedSlots: OccupiedSlot[],
): SlotInfo['status'] {
  let hasBooking = false;
  let hasGoogle = false;

  for (const occupied of occupiedSlots) {
    const oStart = new Date(occupied.startTime);
    const oEnd = new Date(occupied.endTime);

    if (!overlaps(slotStart, slotEnd, oStart, oEnd)) {
      continue;
    }

    if (occupied.source === 'booking') {
      hasBooking = true;
    } else {
      hasGoogle = true;
    }
  }

  if (hasBooking && hasGoogle) return 'both';
  if (hasBooking) return 'booking';
  if (hasGoogle) return 'google_calendar';
  return 'available';
}

const STATUS_STYLES: Record<SlotInfo['status'], string> = {
  available:
    'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100',
  booking: 'border-red-200 bg-red-50 text-red-900',
  google_calendar: 'border-amber-200 bg-amber-50 text-amber-900',
  both: 'border-orange-300 bg-orange-50 text-orange-900',
};

const STATUS_LABELS: Record<SlotInfo['status'], string> = {
  available: 'Disponible',
  booking: 'Reserva interna',
  google_calendar: 'Google Calendar',
  both: 'Ocupado (reserva + Google)',
};

interface AvailabilityGridProps {
  date: string;
  timeZone: string;
  occupiedSlots: OccupiedSlot[];
  isLoading?: boolean;
  isFetching?: boolean;
}

export function AvailabilityGrid({
  date,
  timeZone,
  occupiedSlots,
  isLoading = false,
  isFetching = false,
}: AvailabilityGridProps) {
  const slots = useMemo(() => {
    const base = buildSlots(date, timeZone);
    return base.map((slot) => ({
      ...slot,
      status: resolveSlotStatus(slot.start, slot.end, occupiedSlots),
    }));
  }, [date, timeZone, occupiedSlots]);

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Cargando disponibilidad">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {isFetching && (
        <div className="mb-3">
          <Spinner label="Actualizando disponibilidad…" />
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3 text-xs text-neutral-600">
        {(['available', 'booking', 'google_calendar', 'both'] as const).map(
          (status) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span
                className={`inline-block size-3 rounded-sm border ${STATUS_STYLES[status].split(' ').slice(0, 2).join(' ')}`}
                aria-hidden="true"
              />
              {STATUS_LABELS[status]}
            </span>
          ),
        )}
      </div>

      <div
        className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
        role="list"
        aria-label={`Franjas horarias para ${date}`}
      >
        {slots.map((slot) => (
          <div
            key={slot.label}
            role="listitem"
            aria-label={`${slot.label}: ${STATUS_LABELS[slot.status]}`}
            className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${STATUS_STYLES[slot.status]}`}
          >
            <span className="block">{slot.label}</span>
            <span className="mt-0.5 block text-xs font-normal opacity-80">
              {STATUS_LABELS[slot.status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export type { OccupiedSlotSource };
