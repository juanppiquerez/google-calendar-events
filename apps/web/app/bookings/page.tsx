import { redirect } from 'next/navigation';
import { DashboardShell } from '@/app/components/dashboard-shell';
import { getAppSession } from '@/lib/get-app-session';
import { BookingsPageClient } from './bookings-page-client';

export default async function BookingsPage() {
  const session = await getAppSession();

  if (!session) {
    redirect('/auth/login?connection=google-oauth2');
  }

  return (
    <DashboardShell
      userName={session.user.name ?? session.user.email ?? 'Usuario'}
      userEmail={session.user.email ?? undefined}
    >
      <BookingsPageClient />
    </DashboardShell>
  );
}
