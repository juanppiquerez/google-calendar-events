'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  disconnectGoogle,
  fetchGoogleStatus,
  getGoogleConnectUrl,
} from '@/lib/google-client';

const GOOGLE_STATUS_KEY = ['google', 'status'] as const;

export function GoogleCalendarCard() {
  const queryClient = useQueryClient();
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: GOOGLE_STATUS_KEY,
    queryFn: fetchGoogleStatus,
  });

  const connectMutation = useMutation({
    mutationFn: getGoogleConnectUrl,
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: (error: unknown) => {
      setActionError(
        error instanceof Error
          ? error.message
          : 'No se pudo iniciar la conexión con Google',
      );
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectGoogle,
    onSuccess: () => {
      setShowDisconnectConfirm(false);
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: GOOGLE_STATUS_KEY });
    },
    onError: (error: unknown) => {
      setActionError(
        error instanceof Error
          ? error.message
          : 'No se pudo desconectar Google Calendar',
      );
    },
  });

  const connected = statusQuery.data?.connected && statusQuery.data?.isValid;
  const needsReconnect =
    statusQuery.data?.connected && statusQuery.data?.isValid === false;

  return (
    <section className="mt-6 w-full max-w-md rounded-lg border border-neutral-200 p-6">
      <h2 className="text-lg font-medium">Google Calendar</h2>
      <p className="mt-2 text-sm text-neutral-600">
        Conectá tu calendario para detectar conflictos con eventos reales al
        crear reservas. Es independiente del inicio de sesión con Auth0.
      </p>

      {statusQuery.isLoading && (
        <p className="mt-4 text-sm text-neutral-500">Verificando estado…</p>
      )}

      {statusQuery.isError && (
        <p className="mt-4 text-sm text-red-600">
          No se pudo cargar el estado de Google Calendar.
        </p>
      )}

      {statusQuery.isSuccess && (
        <div className="mt-4">
          {connected ? (
            <p className="text-sm font-medium text-green-700">
              Google Calendar conectado ✅
            </p>
          ) : needsReconnect ? (
            <p className="text-sm font-medium text-amber-700">
              Conexión expirada ⚠️ — Reconectá tu cuenta de Google
            </p>
          ) : (
            <p className="text-sm font-medium text-amber-700">
              No conectado ⚠️ — Conectar
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            {!connected && (
              <button
                type="button"
                disabled={connectMutation.isPending}
                onClick={() => {
                  setActionError(null);
                  connectMutation.mutate();
                }}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
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
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
              >
                Desconectar Google Calendar
              </button>
            )}
          </div>
        </div>
      )}

      {actionError && (
        <p className="mt-3 text-sm text-red-600">{actionError}</p>
      )}

      {showDisconnectConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="disconnect-google-title"
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg"
          >
            <h3 id="disconnect-google-title" className="text-lg font-medium">
              ¿Desconectar Google Calendar?
            </h3>
            <p className="mt-2 text-sm text-neutral-600">
              Las nuevas reservas ya no se verificarán contra tu calendario de
              Google. Podés volver a conectar cuando quieras.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDisconnectConfirm(false)}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={disconnectMutation.isPending}
                onClick={() => disconnectMutation.mutate()}
                className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {disconnectMutation.isPending
                  ? 'Desconectando…'
                  : 'Confirmar desconexión'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
