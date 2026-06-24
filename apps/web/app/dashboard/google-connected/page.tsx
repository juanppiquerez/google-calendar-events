import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAppSession } from '@/lib/get-app-session';
import { GoogleConnectedToast } from './google-connected-toast';

export default async function GoogleConnectedPage() {
  const session = await getAppSession();

  if (!session) {
    redirect('/auth/login?connection=google-oauth2');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <GoogleConnectedToast />
      <div className="w-full max-w-md rounded-lg border border-green-200 bg-green-50 p-8 text-center">
        <p className="text-4xl" aria-hidden>
          ✅
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-green-900">
          Google Calendar conectado
        </h1>
        <p className="mt-3 text-sm text-green-800">
          Tu calendario quedó vinculado correctamente. Al crear reservas,
          verificaremos conflictos con tus eventos de Google.
        </p>
      </div>

      <div className="mt-8 flex gap-4">
        <Link
          href="/dashboard"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800"
        >
          Volver al dashboard
        </Link>
        <Link
          href="/bookings"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
        >
          Mis reservas
        </Link>
      </div>
    </main>
  );
}
