import { AuthUser, JwtPayload } from './auth-user.interface';

export function mapPayloadToAuthUser(payload: JwtPayload): AuthUser {
  const email =
    payload.email ??
    (typeof payload['https://booking.app/email'] === 'string'
      ? payload['https://booking.app/email']
      : undefined);

  const name =
    payload.name ??
    (typeof payload['https://booking.app/name'] === 'string'
      ? payload['https://booking.app/name']
      : undefined);

  return {
    sub: payload.sub,
    email,
    name,
  };
}
