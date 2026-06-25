export function isRetryableGoogleError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as {
    code?: string | number;
    response?: { status?: number };
    message?: string;
  };

  const status =
    err.response?.status ??
    (typeof err.code === 'number' ? err.code : undefined);

  if (status === 429 || status === 503) {
    return true;
  }

  if (
    err.code === 'ETIMEDOUT' ||
    err.code === 'ECONNRESET' ||
    err.code === 'ENOTFOUND'
  ) {
    return true;
  }

  if (typeof err.message === 'string' && /timeout/i.test(err.message)) {
    return true;
  }

  return false;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  initialBackoffMs: number,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryableGoogleError(error) || attempt === maxAttempts) {
        throw error;
      }

      const delay = initialBackoffMs * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
