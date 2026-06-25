import { signOAuthState, verifyOAuthState } from './google-oauth-state';

describe('google-oauth-state', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'f'.repeat(64);
  });

  it('signs and verifies a valid state payload', () => {
    const state = signOAuthState('user-123');
    const payload = verifyOAuthState(state);

    expect(payload.userId).toBe('user-123');
    expect(payload.issuedAt).toBeLessThanOrEqual(Date.now());
  });

  it('rejects tampered state signatures', () => {
    const state = signOAuthState('user-123');
    const [encoded] = state.split('.');
    const tampered = `${encoded}.invalid-signature`;

    expect(() => verifyOAuthState(tampered)).toThrow(
      'Invalid OAuth state signature',
    );
  });

  it('rejects expired state', () => {
    const base = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(base);
    const state = signOAuthState('user-123');
    jest.spyOn(Date, 'now').mockReturnValue(base + 11 * 60 * 1_000 + 1);

    expect(() => verifyOAuthState(state)).toThrow('OAuth state expired');
    jest.restoreAllMocks();
  });
});
