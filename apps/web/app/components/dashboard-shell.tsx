'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchGoogleStatus } from '@/lib/google-client';
import { Skeleton } from '@/app/components/ui/skeleton';

const NAV_ITEMS = [
  { href: '/bookings', label: 'My bookings', exact: true },
  { href: '/bookings/new', label: 'New booking', exact: false },
] as const;

interface DashboardShellProps {
  userName: string;
  userEmail?: string;
  children: React.ReactNode;
}

export function DashboardShell({
  userName,
  userEmail,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const googleStatusQuery = useQuery({
    queryKey: ['google', 'status'],
    queryFn: fetchGoogleStatus,
  });

  const googleConnected =
    googleStatusQuery.data?.connected && googleStatusQuery.data?.isValid;
  const googleNeedsReconnect =
    googleStatusQuery.data?.connected && googleStatusQuery.data?.isValid === false;

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Booking System
            </p>
            <h1 className="text-lg font-semibold text-neutral-900">{userName}</h1>
            {userEmail && (
              <p className="text-sm text-neutral-600">{userEmail}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {googleStatusQuery.isLoading ? (
              <Skeleton className="h-8 w-40" />
            ) : googleConnected ? (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                Google Calendar connected
              </span>
            ) : googleNeedsReconnect ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
              >
                Reconnect Google Calendar
              </Link>
            ) : (
              <Link
                href="/dashboard"
                className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-600"
              >
                Connect Google Calendar
              </Link>
            )}

            <a
              href="/auth/logout"
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            >
              Log out
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        <nav
          aria-label="Dashboard sections"
          className="flex shrink-0 gap-2 lg:w-48 lg:flex-col"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`rounded-md px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 ${
                  isActive
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
