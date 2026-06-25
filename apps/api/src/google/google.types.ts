import type { GoogleToken } from '@prisma/client';

export interface BusyBlock {
  start: string;
  end: string;
}

export interface BusyBlocksResult {
  blocks: BusyBlock[];
  syncError?: string;
}

export interface GoogleConnectionStatus {
  connected: boolean;
  isValid: boolean;
  syncHealthy: boolean;
  syncError?: string;
}

export interface CalendarConflictChecker {
  hasConflict(userId: string, start: Date, end: Date): Promise<boolean>;
  getBusyBlocks(userId: string, start: Date, end: Date): Promise<BusyBlocksResult>;
}

export const CALENDAR_CONFLICT_CHECKER = Symbol('CALENDAR_CONFLICT_CHECKER');

export interface DecryptedGoogleToken {
  record: GoogleToken;
  accessToken: string;
  refreshToken: string;
}
