import { JwtAuthGuard } from './jwt-auth.guard';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  it('returns the user when the JWT is valid', () => {
    const user = { sub: 'auth0|123', email: 'user@example.com' };

    expect(guard.handleRequest(null, user, undefined)).toEqual(user);
  });

  it('throws 401 when the JWT is expired', () => {
    const expiredError = new Error('jwt expired');
    expiredError.name = 'TokenExpiredError';

    expect(() => guard.handleRequest(null, false, expiredError)).toThrow(
      new UnauthorizedException('Access token expired'),
    );
  });

  it('throws 401 when the JWT is invalid or missing', () => {
    const invalidError = new Error('jwt malformed');
    invalidError.name = 'JsonWebTokenError';

    expect(() => guard.handleRequest(null, false, invalidError)).toThrow(
      new UnauthorizedException('Invalid or missing access token'),
    );
  });

  it('throws 401 when user is false without specific token error', () => {
    expect(() => guard.handleRequest(null, false, undefined)).toThrow(
      new UnauthorizedException('Invalid or missing access token'),
    );
  });

  it('throws 401 when passport returns an error', () => {
    const authError = new Error('authentication failed');

    expect(() => guard.handleRequest(authError, false, undefined)).toThrow(
      new UnauthorizedException('Invalid or missing access token'),
    );
  });
});
