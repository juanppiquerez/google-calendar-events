import { mapPayloadToAuthUser } from './auth-user.mapper';

describe('JwtStrategy (payload mapping)', () => {
  it('maps standard claims from a valid JWT payload', () => {
    const user = mapPayloadToAuthUser({
      sub: 'auth0|123',
      email: 'user@example.com',
      name: 'Test User',
    });

    expect(user).toEqual({
      sub: 'auth0|123',
      email: 'user@example.com',
      name: 'Test User',
    });
  });

  it('maps custom namespace claims when standard claims are absent', () => {
    const user = mapPayloadToAuthUser({
      sub: 'google-oauth2|456',
      'https://booking.app/email': 'custom@example.com',
      'https://booking.app/name': 'Custom Name',
    });

    expect(user).toEqual({
      sub: 'google-oauth2|456',
      email: 'custom@example.com',
      name: 'Custom Name',
    });
  });
});
