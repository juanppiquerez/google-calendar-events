import { createHmac, timingSafeEqual } from 'node:crypto';

const STATE_TTL_MS = 10 * 60 * 1_000;

export interface OAuthStatePayload {
  userId: string;
  issuedAt: number;
}

function getStateSecret(): string {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  return secret;
}

export function signOAuthState(userId: string): string {
  const payload: OAuthStatePayload = {
    userId,
    issuedAt: Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', getStateSecret())
    .update(encoded)
    .digest('base64url');

  return `${encoded}.${signature}`;
}

export function verifyOAuthState(state: string): OAuthStatePayload {
  const [encoded, signature] = state.split('.');
  if (!encoded || !signature) {
    throw new Error('Invalid OAuth state');
  }

  const expected = createHmac('sha256', getStateSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (
    sigBuf.length !== expectedBuf.length ||
    !timingSafeEqual(sigBuf, expectedBuf)
  ) {
    throw new Error('Invalid OAuth state signature');
  }

  const payload = JSON.parse(
    Buffer.from(encoded, 'base64url').toString('utf8'),
  ) as OAuthStatePayload;

  if (Date.now() - payload.issuedAt > STATE_TTL_MS) {
    throw new Error('OAuth state expired');
  }

  return payload;
}
