import type { SessionData } from '@auth0/nextjs-auth0/types';
import { auth0 } from './auth0';

const E2E_TEST_SESSION = {
  user: {
    sub: 'auth0|e2e-test-user',
    name: 'E2E Test User',
    email: 'e2e@test.example.com',
  },
  tokenSet: {
    accessToken: 'e2e-test-access-token',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  },
  internal: {
    sid: 'e2e-test-session',
    createdAt: Date.now(),
  },
} as SessionData;

export async function getAppSession(): Promise<SessionData | null> {
  if (process.env.E2E_TEST_MODE === 'true') {
    return E2E_TEST_SESSION;
  }

  return auth0.getSession();
}
