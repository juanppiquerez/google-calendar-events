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
  fallbackMessage = 'An unexpected error occurred',
  onRetry,
}: ErrorStateProps) {
  const message = getErrorMessage(error, fallbackMessage);
  const isConflict = isConflictError(error);
  const isServer = isServerError(error);
  const isNetwork = isNetworkError(error);

  let title = 'Error';
  if (isConflict) title = 'Schedule conflict';
  else if (isNetwork) title = 'Connection error';
  else if (isServer) title = 'Server error';

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
          Retry
        </button>
      )}
    </div>
  );
}
