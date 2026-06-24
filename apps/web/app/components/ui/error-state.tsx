'use client';

import {
  getErrorMessage,
  isConflictError,
  isNetworkError,
  isServerError,
} from '@/lib/api-error';

interface ErrorStateProps {
  error: unknown;
  fallbackMessage?: string;
  onRetry?: () => void;
}

export function ErrorState({
  error,
  fallbackMessage = 'Ocurrió un error inesperado',
  onRetry,
}: ErrorStateProps) {
  const message = getErrorMessage(error, fallbackMessage);
  const isConflict = isConflictError(error);
  const isServer = isServerError(error);
  const isNetwork = isNetworkError(error);

  let title = 'Error';
  if (isConflict) title = 'Conflicto de horario';
  else if (isNetwork) title = 'Error de conexión';
  else if (isServer) title = 'Error del servidor';

  return (
    <div
      role="alert"
      className={`rounded-lg border px-4 py-3 text-sm ${
        isConflict
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-red-200 bg-red-50 text-red-800'
      }`}
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1">{message}</p>
      {(isServer || isNetwork) && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md border border-current px-3 py-1.5 text-sm font-medium hover:bg-white/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
