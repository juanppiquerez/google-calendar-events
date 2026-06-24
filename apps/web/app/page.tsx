import Link from 'next/link';
import { getAppSession } from '@/lib/get-app-session';

export default async function Home() {
  const session = await getAppSession();

  if (!session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <h1 className="text-3xl font-semibold tracking-tight">Booking System</h1>
        <p className="mt-4 text-neutral-600">
          Inicia sesión para acceder al sistema de reservas.
        </p>
        <a
          href="/auth/login?connection=google-oauth2"
          className="mt-8 rounded-md bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Iniciar sesión con Google
        </a>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Booking System</h1>
      <p className="mt-4 text-neutral-600">
        Hola, {session.user.name ?? session.user.email}
      </p>
      {session.user.email && (
        <p className="mt-1 text-sm text-neutral-500">{session.user.email}</p>
      )}

      <div className="mt-8 flex gap-4">
        <Link
          href="/bookings"
          className="rounded-md bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          Ir a mis reservas
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md border border-neutral-300 px-6 py-3 text-sm font-medium hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          Configuración
        </Link>
        <a
          href="/auth/logout"
          className="rounded-md border border-neutral-300 px-6 py-3 text-sm font-medium hover:bg-neutral-50"
        >
          Cerrar sesión
        </a>
      </div>
    </main>
  );
}
