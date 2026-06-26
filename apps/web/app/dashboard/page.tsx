import { redirect } from 'next/navigation';
import { DashboardShell } from '@/app/components/dashboard-shell';
import { getAppSession } from '@/lib/get-app-session';
import { GoogleCalendarCard } from './google-calendar-card';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const session = await getAppSession();
  const params = await searchParams;

  if (!session) {
    redirect('/auth/login?connection=google-oauth2');
  }

  return (
    <DashboardShell
      userName={session.user.name ?? session.user.email ?? 'User'}
      userEmail={session.user.email ?? undefined}
    >
      <div className="space-y-6">
        <header>
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Settings
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Manage your Google Calendar integration and access your bookings.
          </p>
        </header>

        {params.google === 'error' && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            Could not connect Google Calendar. Please try again.
          </p>
        )}

        <GoogleCalendarCard />
      </div>
    </DashboardShell>
  );
}
