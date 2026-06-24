/** Global default: 100 requests per minute per IP. */
export const THROTTLE_DEFAULT_TTL_MS = 60_000;
export const THROTTLE_DEFAULT_LIMIT = 100;

/** Stricter limit for booking creation and Google OAuth endpoints. */
export const THROTTLE_STRICT_TTL_MS = 60_000;
export const THROTTLE_STRICT_LIMIT = 10;
