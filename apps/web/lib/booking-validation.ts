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
    return 'El título es obligatorio';
  }

  if (title.length > 200) {
    return 'El título no puede superar 200 caracteres';
  }

  const start = new Date(`${input.date}T${input.startTime}`);
  const end = new Date(`${input.date}T${input.endTime}`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Fecha u hora inválida';
  }

  if (start >= end) {
    return 'La hora de fin debe ser posterior a la de inicio';
  }

  if (start.getTime() < Date.now() - PAST_START_TOLERANCE_MS) {
    return 'La fecha y hora no pueden estar en el pasado';
  }

  return null;
}
