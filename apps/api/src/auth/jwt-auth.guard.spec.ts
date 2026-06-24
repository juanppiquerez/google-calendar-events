import { JwtAuthGuard } from './jwt-auth.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  const context = {} as ExecutionContext;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  it('returns the user when the JWT is valid', () => {
    const user = { sub: 'auth0|123', email: 'user@example.com' };

    expect(guard.handleRequest(null, user, undefined, context)).toEqual(user);
  });

  it('throws 401 when the JWT is expired', () => {
    const expiredError = new Error('jwt expired');
    expiredError.name = 'TokenExpiredError';

    expect(() => guard.handleRequest(null, false, expiredError, context)).toThrow(
      new UnauthorizedException('Access token expired'),
    );
  });

  it('throws 401 when the JWT is invalid or missing', () => {
    const invalidError = new Error('jwt malformed');
    invalidError.name = 'JsonWebTokenError';

    expect(() =>
      guard.handleRequest(null, false, invalidError, context),
    ).toThrow(new UnauthorizedException('Invalid or missing access token'));
  });
});
