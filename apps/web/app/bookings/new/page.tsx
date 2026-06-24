import { redirect } from 'next/navigation';
import { BookingForm } from '@/app/components/booking-form';
import { DashboardShell } from '@/app/components/dashboard-shell';
import { auth0 } from '@/lib/auth0';

export default async function NewBookingPage() {
  const session = await auth0.getSession();

  if (!session) {
    redirect('/auth/login?connection=google-oauth2');
  }

  return (
    <DashboardShell
      userName={session.user.name ?? session.user.email ?? 'Usuario'}
      userEmail={session.user.email ?? undefined}
    >
      <BookingForm />
    </DashboardShell>
  );
}
