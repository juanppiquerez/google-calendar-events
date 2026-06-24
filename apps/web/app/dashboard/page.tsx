import type { User } from '@booking/shared-types';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ApiError, apiFetch } from '@/lib/api-client';
import { auth0 } from '@/lib/auth0';
import { GoogleCalendarCard } from './google-calendar-card';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const session = await auth0.getSession();
  const params = await searchParams;

  if (!session) {
    redirect('/auth/login?connection=google-oauth2');
  }

  let dbUser: User;

  try {
    dbUser = await apiFetch<User>('/users/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect('/auth/login?connection=google-oauth2');
    }

    throw error;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-4 text-neutral-600">
        Sesión Auth0 y usuario en base de datos verificados correctamente.
      </p>

      {params.google === 'error' && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          No se pudo conectar Google Calendar. Intentá de nuevo.
        </p>
      )}

      <section className="mt-8 w-full max-w-md rounded-lg border border-neutral-200 p-6">
        <h2 className="text-lg font-medium">Sesión Auth0</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="text-neutral-500">Nombre</dt>
            <dd>{session.user.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Email</dt>
            <dd>{session.user.email ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 w-full max-w-md rounded-lg border border-neutral-200 p-6">
        <h2 className="text-lg font-medium">Usuario en la API</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="text-neutral-500">ID</dt>
            <dd className="font-mono text-xs">{dbUser.id}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Auth0 ID</dt>
            <dd className="font-mono text-xs">{dbUser.auth0Id}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Nombre</dt>
            <dd>{dbUser.name}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Email</dt>
            <dd>{dbUser.email}</dd>
          </div>
        </dl>
      </section>

      <GoogleCalendarCard />

      <div className="mt-8 flex gap-4">
        <Link
          href="/bookings"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800"
        >
          Mis reservas
        </Link>
        <Link
          href="/"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
        >
          Inicio
        </Link>
        <a
          href="/auth/logout"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800"
        >
          Cerrar sesión
        </a>
      </div>
    </main>
  );
}
