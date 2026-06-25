export interface GoogleConnectionStatus {
  connected: boolean;
  isValid: boolean;
  syncHealthy: boolean;
  syncError?: string;
}

export class GoogleApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GoogleApiError';
  }
}

async function parseErrorMessage(response: Response): Promise<string> {
  const text = await response.text();

  try {
    const body = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(body.message)) {
      return body.message.join(', ');
    }
    if (body.message) {
      return body.message;
    }
  } catch {
    // fall through
  }

  return text || response.statusText;
}

export async function fetchGoogleStatus(): Promise<GoogleConnectionStatus> {
  const response = await fetch('/api/google/status');

  if (!response.ok) {
    throw new GoogleApiError(
      response.status,
      await parseErrorMessage(response),
    );
  }

  return response.json() as Promise<GoogleConnectionStatus>;
}

export async function getGoogleConnectUrl(): Promise<string> {
  const response = await fetch('/api/google/connect');

  if (!response.ok) {
    throw new GoogleApiError(
      response.status,
      await parseErrorMessage(response),
    );
  }

  const body = (await response.json()) as { url: string };
  return body.url;
}

export async function disconnectGoogle(): Promise<void> {
  const response = await fetch('/api/google/disconnect', {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new GoogleApiError(
      response.status,
      await parseErrorMessage(response),
    );
  }
}
