import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { GoogleToken } from '@prisma/client';
import { google } from 'googleapis';
import { EncryptionService } from '../encryption/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  GOOGLE_API_INITIAL_BACKOFF_MS,
  GOOGLE_API_MAX_RETRIES,
  GOOGLE_CALENDAR_SCOPE,
  TOKEN_REFRESH_BUFFER_MS,
} from './google.constants';
import { signOAuthState, verifyOAuthState } from './google-oauth-state';
import type { CalendarConflictChecker } from './google.types';
import { retryWithBackoff } from './retry-with-backoff';

function isInvalidGrantError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as { message?: string; response?: { data?: { error?: string } } };
  const message = err.message ?? '';
  const dataError = err.response?.data?.error ?? '';

  return (
    dataError === 'invalid_grant' ||
    /invalid_grant/i.test(message)
  );
}

function busyBlocksOverlap(
  busy: Array<{ start?: string | null; end?: string | null }>,
  start: Date,
  end: Date,
): boolean {
  return busy.some((block) => {
    if (!block.start || !block.end) {
      return false;
    }

    const blockStart = new Date(block.start);
    const blockEnd = new Date(block.end);
    return blockStart < end && blockEnd > start;
  });
}

@Injectable()
export class GoogleService implements CalendarConflictChecker {
  private readonly logger = new Logger(GoogleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  getAuthorizationUrl(userId: string): string {
    const client = this.createOAuthClient();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [GOOGLE_CALENDAR_SCOPE],
      state: signOAuthState(userId),
    });
  }

  async handleOAuthCallback(code: string, state: string): Promise<string> {
    const { userId } = verifyOAuthState(state);
    const client = this.createOAuthClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new BadRequestException(
        'Google did not return the required tokens. Try disconnecting and reconnecting with consent.',
      );
    }

    const expiryDate = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3_600_000);

    await this.upsertToken(userId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate,
      scope: tokens.scope ?? GOOGLE_CALENDAR_SCOPE,
    });

    return this.getSuccessRedirectUrl();
  }

  async getConnectionStatus(userId: string): Promise<{ connected: boolean; isValid: boolean }> {
    const token = await this.prisma.googleToken.findUnique({
      where: { userId },
    });

    if (!token) {
      return { connected: false, isValid: false };
    }

    return { connected: true, isValid: token.isValid };
  }

  async disconnect(userId: string): Promise<void> {
    const token = await this.prisma.googleToken.findUnique({
      where: { userId },
    });

    if (!token) {
      throw new NotFoundException('Google Calendar is not connected');
    }

    try {
      const refreshToken = this.encryption.decrypt(token.refreshToken);
      const client = this.createOAuthClient();
      await client.revokeToken(refreshToken);
    } catch (error) {
      this.logger.warn(
        `Failed to revoke Google token for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    await this.prisma.googleToken.delete({ where: { userId } });
  }

  async hasConflict(userId: string, start: Date, end: Date): Promise<boolean> {
    const token = await this.prisma.googleToken.findUnique({
      where: { userId },
    });

    if (!token || !token.isValid) {
      return false;
    }

    let accessToken: string;
    let refreshToken: string;
    let expiryDate = token.expiryDate;

    try {
      accessToken = this.encryption.decrypt(token.accessToken);
      refreshToken = this.encryption.decrypt(token.refreshToken);
    } catch (error) {
      this.logger.error(
        `Failed to decrypt Google tokens for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }

    const needsRefresh =
      expiryDate.getTime() - Date.now() < TOKEN_REFRESH_BUFFER_MS;

    if (needsRefresh) {
      const refreshed = await this.refreshAccessToken(userId, token, refreshToken);
      if (!refreshed) {
        return false;
      }

      accessToken = refreshed.accessToken;
      expiryDate = refreshed.expiryDate;
    }

    try {
      const busy = await retryWithBackoff(
        () => this.queryFreeBusy(accessToken, refreshToken, expiryDate, start, end),
        GOOGLE_API_MAX_RETRIES,
        GOOGLE_API_INITIAL_BACKOFF_MS,
      );

      return busyBlocksOverlap(busy, start, end);
    } catch (error) {
      this.logger.warn(
        `No se pudo verificar Google Calendar para user ${userId}, booking creado sin esa verificación: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  private async refreshAccessToken(
    userId: string,
    token: GoogleToken,
    refreshToken: string,
  ): Promise<{ accessToken: string; expiryDate: Date } | null> {
    const client = this.createOAuthClient();
    client.setCredentials({ refresh_token: refreshToken });

    try {
      const { credentials } = await client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error('Google refresh response missing access_token');
      }

      const expiryDate = credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : new Date(Date.now() + 3_600_000);

      await this.upsertToken(userId, {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token ?? refreshToken,
        expiryDate,
        scope: token.scope,
      });

      return { accessToken: credentials.access_token, expiryDate };
    } catch (error) {
      if (isInvalidGrantError(error)) {
        await this.prisma.googleToken.update({
          where: { userId },
          data: { isValid: false },
        });
        this.logger.warn(
          `Google token invalid_grant for user ${userId}; user must reconnect Google Calendar`,
        );
        return null;
      }

      this.logger.warn(
        `Failed to refresh Google token for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async queryFreeBusy(
    accessToken: string,
    refreshToken: string,
    expiryDate: Date,
    start: Date,
    end: Date,
  ): Promise<Array<{ start?: string | null; end?: string | null }>> {
    const client = this.createAuthenticatedClient(
      accessToken,
      refreshToken,
      expiryDate,
    );
    const calendar = google.calendar({ version: 'v3', auth: client });

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: 'primary' }],
      },
    });

    return response.data.calendars?.primary?.busy ?? [];
  }

  private async upsertToken(
    userId: string,
    data: {
      accessToken: string;
      refreshToken: string;
      expiryDate: Date;
      scope: string;
    },
  ): Promise<void> {
    await this.prisma.googleToken.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: this.encryption.encrypt(data.accessToken),
        refreshToken: this.encryption.encrypt(data.refreshToken),
        expiryDate: data.expiryDate,
        scope: data.scope,
        isValid: true,
      },
      update: {
        accessToken: this.encryption.encrypt(data.accessToken),
        refreshToken: this.encryption.encrypt(data.refreshToken),
        expiryDate: data.expiryDate,
        scope: data.scope,
        isValid: true,
      },
    });
  }

  private createOAuthClient(): InstanceType<typeof google.auth.OAuth2> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error(
        'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI must be set',
      );
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  private createAuthenticatedClient(
    accessToken: string,
    refreshToken: string,
    expiryDate: Date,
  ): InstanceType<typeof google.auth.OAuth2> {
    const client = this.createOAuthClient();
    client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: expiryDate.getTime(),
    });
    return client;
  }

  private getSuccessRedirectUrl(): string {
    const base = process.env.APP_BASE_URL ?? 'http://localhost:3000';
    return `${base}/dashboard/google-connected`;
  }
}
