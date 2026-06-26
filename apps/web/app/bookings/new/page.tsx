import { redirect } from 'next/navigation';
import { BookingForm } from '@/app/components/booking-form';
import { DashboardShell } from '@/app/components/dashboard-shell';
import { getAppSession } from '@/lib/get-app-session';

export default async function NewBookingPage() {
  const session = await getAppSession();

  if (!session) {
    redirect('/auth/login?connection=google-oauth2');
  }

  return (
    <DashboardShell
      userName={session.user.name ?? session.user.email ?? 'User'}
      userEmail={session.user.email ?? undefined}
    >
      <BookingForm />
    </DashboardShell>
  );
}
