import type { GoogleToken } from '@prisma/client';

export interface CalendarConflictChecker {
  hasConflict(userId: string, start: Date, end: Date): Promise<boolean>;
}

export const CALENDAR_CONFLICT_CHECKER = Symbol('CALENDAR_CONFLICT_CHECKER');

export interface DecryptedGoogleToken {
  record: GoogleToken;
  accessToken: string;
  refreshToken: string;
}
