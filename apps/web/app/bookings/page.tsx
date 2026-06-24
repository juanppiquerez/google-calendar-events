import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth0 } from '@/lib/auth0';
import { BookingsClient } from './bookings-client';

export default async function BookingsPage() {
  const session = await auth0.getSession();

  if (!session) {
    redirect('/auth/login?connection=google-oauth2');
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mb-8">
        <Link
          href="/"
          className="text-sm text-neutral-500 hover:text-neutral-800"
        >
          ← Inicio
        </Link>
      </div>
      <BookingsClient />
    </main>
  );
}
