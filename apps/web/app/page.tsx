import { BookingStatus } from '@booking/shared-types';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Booking System</h1>
      <p className="mt-4 text-neutral-600">
        Schedule reservations with Google Calendar conflict validation.
      </p>
      <p className="mt-2 text-sm text-neutral-500">
        Shared types wired: default booking status is{' '}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5">{BookingStatus.CONFIRMED}</code>
      </p>
    </main>
  );
}
