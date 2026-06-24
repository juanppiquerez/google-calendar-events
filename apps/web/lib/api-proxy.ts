import { auth0 } from '@/lib/auth0';

const API_BASE_URL =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001';

export async function proxyToApi(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const { token } = await auth0.getAccessToken();

  return fetch(`${API_BASE_URL}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });
}
