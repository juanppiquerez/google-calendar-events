'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/app/components/confirm-dialog';
import { ErrorState } from '@/app/components/ui/error-state';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Spinner } from '@/app/components/ui/spinner';
import { getErrorMessage, redirectOnUnauthorized } from '@/lib/api-error';
import { useRedirectOnUnauthorized } from '@/lib/use-redirect-on-unauthorized';
import {
  disconnectGoogle,
  fetchGoogleStatus,
  getGoogleConnectUrl,
} from '@/lib/google-client';

const GOOGLE_STATUS_KEY = ['google', 'status'] as const;

export function GoogleCalendarCard() {
  const queryClient = useQueryClient();
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const statusQuery = useQuery({
    queryKey: GOOGLE_STATUS_KEY,
    queryFn: fetchGoogleStatus,
  });

  useRedirectOnUnauthorized(statusQuery.error);

  const connectMutation = useMutation({
    mutationFn: getGoogleConnectUrl,
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: (error: unknown) => {
      redirectOnUnauthorized(error);
      toast.error(
        getErrorMessage(error, 'No se pudo iniciar la conexión con Google'),
      );
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectGoogle,
    onSuccess: () => {
      setShowDisconnectConfirm(false);
      toast.success('Google Calendar desconectado');
      void queryClient.invalidateQueries({ queryKey: GOOGLE_STATUS_KEY });
    },
    onError: (error: unknown) => {
      redirectOnUnauthorized(error);
      toast.error(
        getErrorMessage(error, 'No se pudo desconectar Google Calendar'),
      );
    },
  });

  const connected = statusQuery.data?.connected && statusQuery.data?.isValid;
  const needsReconnect =
    statusQuery.data?.connected && statusQuery.data?.isValid === false;

  return (
    <section
      aria-labelledby="google-calendar-heading"
      className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <h2 id="google-calendar-heading" className="text-lg font-semibold text-neutral-900">
        Google Calendar
      </h2>
      <p className="mt-2 text-sm text-neutral-600">
        Conectá tu calendario para detectar conflictos con eventos reales al crear
        reservas. Es independiente del inicio de sesión con Auth0.
      </p>

      {statusQuery.isLoading && (
        <div className="mt-4 space-y-2">
          <Skeleton className="mt-4 h-5 w-48" />
          <Skeleton className="h-10 w-56" />
        </div>
      )}

      {statusQuery.isError && (
        <div className="mt-4">
          <ErrorState
            error={statusQuery.error}
            fallbackMessage="No se pudo cargar el estado de Google Calendar"
            onRetry={() => void statusQuery.refetch()}
          />
        </div>
      )}

      {statusQuery.isSuccess && (
        <div className="mt-4">
          {statusQuery.isFetching && !statusQuery.isLoading && (
            <div className="mb-3">
              <Spinner label="Actualizando estado…" />
            </div>
          )}

          {connected ? (
            <p className="text-sm font-medium text-emerald-800">
              Google Calendar conectado
            </p>
          ) : needsReconnect ? (
            <p className="text-sm font-medium text-amber-800">
              Conexión expirada — reconectá tu cuenta de Google
            </p>
          ) : (
            <p className="text-sm font-medium text-amber-800">
              No conectado — conectá para ver conflictos de calendario
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            {!connected && (
              <button
                type="button"
                disabled={connectMutation.isPending}
                onClick={() => connectMutation.mutate()}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-50"
              >
                {connectMutation.isPending
                  ? 'Redirigiendo…'
                  : needsReconnect
                    ? 'Reconectar Google Calendar'
                    : 'Conectar Google Calendar'}
              </button>
            )}

            {(connected || needsReconnect) && (
              <button
                type="button"
                onClick={() => setShowDisconnectConfirm(true)}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
              >
                Desconectar Google Calendar
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showDisconnectConfirm}
        title="¿Desconectar Google Calendar?"
        description="Las nuevas reservas ya no se verificarán contra tu calendario de Google. Podés volver a conectar cuando quieras."
        confirmLabel="Confirmar desconexión"
        destructive
        isPending={disconnectMutation.isPending}
        onCancel={() => setShowDisconnectConfirm(false)}
        onConfirm={() => disconnectMutation.mutate()}
      />
    </section>
  );
}
