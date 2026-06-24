'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount, error) => {
              const status =
                error &&
                typeof error === 'object' &&
                'status' in error &&
                typeof (error as { status: unknown }).status === 'number'
                  ? (error as { status: number }).status
                  : null;

              if (status === 401 || status === 409) {
                return false;
              }

              if (status !== null && status >= 500) {
                return failureCount < 2;
              }

              return failureCount < 1;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  );
}
