export interface AuthUser {
  sub: string;
  email?: string;
  name?: string;
}

export interface JwtPayload {
  sub: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
}
