import { BookingsApiError } from '@/lib/bookings-client';
import { GoogleApiError } from '@/lib/google-client';

export function redirectOnUnauthorized(error: unknown): void {
  const status = getErrorStatus(error);
  if (status === 401) {
    window.location.href = '/auth/login?connection=google-oauth2';
  }
}

export function getErrorStatus(error: unknown): number | null {
  if (error instanceof BookingsApiError || error instanceof GoogleApiError) {
    return error.status;
  }
  return null;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof BookingsApiError || error instanceof GoogleApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export function isConflictError(error: unknown): boolean {
  return getErrorStatus(error) === 409;
}

export function isServerError(error: unknown): boolean {
  const status = getErrorStatus(error);
  return status !== null && status >= 500;
}

export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}
