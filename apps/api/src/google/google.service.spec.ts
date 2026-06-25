jest.mock('googleapis', () => {
  const mockFreebusyQuery = jest.fn();
  const mockCalendarList = jest.fn();
  const mockRefreshAccessToken = jest.fn();
  const mockGenerateAuthUrl = jest.fn();
  const mockGetToken = jest.fn();
  const mockRevokeToken = jest.fn();
  const mockSetCredentials = jest.fn();

  const OAuth2 = jest.fn().mockImplementation(() => ({
    generateAuthUrl: mockGenerateAuthUrl,
    getToken: mockGetToken,
    refreshAccessToken: mockRefreshAccessToken,
    revokeToken: mockRevokeToken,
    setCredentials: mockSetCredentials,
  }));

  return {
    google: {
      auth: { OAuth2 },
      calendar: jest.fn(() => ({
        freebusy: { query: mockFreebusyQuery },
        calendarList: { list: mockCalendarList },
      })),
    },
    __mocks: {
      mockFreebusyQuery,
      mockCalendarList,
      mockRefreshAccessToken,
      mockGenerateAuthUrl,
      mockGetToken,
      mockRevokeToken,
    },
  };
});

import { Test, TestingModule } from '@nestjs/testing';
import { google } from 'googleapis';
import { EncryptionService } from '../encryption/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { signOAuthState } from './google-oauth-state';
import { GoogleService } from './google.service';

const {
  mockFreebusyQuery,
  mockCalendarList,
  mockRefreshAccessToken,
  mockGenerateAuthUrl,
  mockGetToken,
  mockRevokeToken,
} = jest.requireMock<{
  __mocks: {
    mockFreebusyQuery: jest.Mock;
    mockCalendarList: jest.Mock;
    mockRefreshAccessToken: jest.Mock;
    mockGenerateAuthUrl: jest.Mock;
    mockGetToken: jest.Mock;
    mockRevokeToken: jest.Mock;
  };
}>('googleapis').__mocks;

function mockCalendarListWithPrimary() {
  mockCalendarList.mockResolvedValue({
    data: {
      items: [{ id: 'primary', selected: true }],
    },
  });
}

describe('GoogleService.hasConflict', () => {
  let service: GoogleService;
  let prisma: {
    googleToken: {
      findUnique: jest.Mock;
      update: jest.Mock;
      upsert: jest.Mock;
      delete: jest.Mock;
    };
  };
  let encryption: {
    encrypt: jest.Mock;
    decrypt: jest.Mock;
    onModuleInit: jest.Mock;
  };

  const userId = 'user-uuid';
  const start = new Date('2026-07-01T10:00:00.000Z');
  const end = new Date('2026-07-01T11:00:00.000Z');

  const validToken = {
    id: 'token-id',
    userId,
    accessToken: 'enc-access',
    refreshToken: 'enc-refresh',
    expiryDate: new Date(Date.now() + 60 * 60 * 1_000),
    scope: 'https://www.googleapis.com/auth/calendar.freebusy',
    isValid: true,
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCalendarListWithPrimary();

    process.env.GOOGLE_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
    process.env.GOOGLE_REDIRECT_URI =
      'http://localhost:3001/api/v1/google/callback';
    process.env.ENCRYPTION_KEY = 'b'.repeat(64);
    process.env.APP_BASE_URL = 'http://localhost:3000';

    prisma = {
      googleToken: {
        findUnique: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
    };

    encryption = {
      encrypt: jest.fn((value: string) => `enc:${value}`),
      decrypt: jest.fn((value: string) => value.replace(/^enc:/, '')),
      onModuleInit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleService,
        { provide: PrismaService, useValue: prisma },
        { provide: EncryptionService, useValue: encryption },
      ],
    }).compile();

    service = module.get(GoogleService);
  });

  it('returns false when user has no connected token', async () => {
    prisma.googleToken.findUnique.mockResolvedValue(null);

    await expect(service.hasConflict(userId, start, end)).resolves.toBe(false);
    expect(mockFreebusyQuery).not.toHaveBeenCalled();
  });

  it('returns false when token is valid and calendar has no busy blocks', async () => {
    prisma.googleToken.findUnique.mockResolvedValue(validToken);
    mockFreebusyQuery.mockResolvedValue({
      data: { calendars: { primary: { busy: [] } } },
    });

    await expect(service.hasConflict(userId, start, end)).resolves.toBe(false);
    expect(mockFreebusyQuery).toHaveBeenCalled();
  });

  it('returns true when token is valid and calendar has overlapping busy blocks', async () => {
    prisma.googleToken.findUnique.mockResolvedValue(validToken);
    mockFreebusyQuery.mockResolvedValue({
      data: {
        calendars: {
          primary: {
            busy: [
              {
                start: '2026-07-01T10:30:00.000Z',
                end: '2026-07-01T11:30:00.000Z',
              },
            ],
          },
        },
      },
    });

    await expect(service.hasConflict(userId, start, end)).resolves.toBe(true);
  });

  it('merges busy blocks from all selected calendars', async () => {
    prisma.googleToken.findUnique.mockResolvedValue(validToken);
    mockCalendarList.mockResolvedValue({
      data: {
        items: [
          { id: 'primary', selected: true },
          { id: 'work@company.com', selected: true },
        ],
      },
    });
    mockFreebusyQuery.mockResolvedValue({
      data: {
        calendars: {
          primary: { busy: [] },
          'work@company.com': {
            busy: [
              {
                start: '2026-07-01T10:30:00.000Z',
                end: '2026-07-01T11:30:00.000Z',
              },
            ],
          },
        },
      },
    });

    await expect(service.hasConflict(userId, start, end)).resolves.toBe(true);
    expect(mockFreebusyQuery).toHaveBeenCalledTimes(1);
    const freebusyCall = (
      mockFreebusyQuery.mock.calls as unknown as [
        { requestBody: { items: { id: string }[] } },
      ]
    )[0];
    expect(freebusyCall.requestBody.items).toEqual([
      { id: 'primary' },
      { id: 'work@company.com' },
    ]);
  });

  it('skips calendars the user deselected in Google Calendar', async () => {
    prisma.googleToken.findUnique.mockResolvedValue(validToken);
    mockCalendarList.mockResolvedValue({
      data: {
        items: [
          { id: 'primary', selected: true },
          { id: 'holidays@group.v.calendar.google.com', selected: false },
        ],
      },
    });
    mockFreebusyQuery.mockResolvedValue({
      data: { calendars: { primary: { busy: [] } } },
    });

    await expect(service.hasConflict(userId, start, end)).resolves.toBe(false);
    expect(mockFreebusyQuery).toHaveBeenCalledTimes(1);
    const freebusyCall = (
      mockFreebusyQuery.mock.calls as unknown as [
        { requestBody: { items: { id: string }[] } },
      ]
    )[0];
    expect(freebusyCall.requestBody.items).toEqual([{ id: 'primary' }]);
  });

  it('refreshes an expiring token and then checks freebusy', async () => {
    const expiringToken = {
      ...validToken,
      expiryDate: new Date(Date.now() + 60_000),
    };
    prisma.googleToken.findUnique.mockResolvedValue(expiringToken);
    mockRefreshAccessToken.mockResolvedValue({
      credentials: {
        access_token: 'new-access',
        expiry_date: Date.now() + 3_600_000,
      },
    });
    mockFreebusyQuery.mockResolvedValue({
      data: { calendars: { primary: { busy: [] } } },
    });

    await expect(service.hasConflict(userId, start, end)).resolves.toBe(false);

    expect(mockRefreshAccessToken).toHaveBeenCalled();
    expect(prisma.googleToken.upsert).toHaveBeenCalled();
    expect(mockFreebusyQuery).toHaveBeenCalled();
  });

  it('marks token invalid and returns false when refresh fails with invalid_grant', async () => {
    const expiringToken = {
      ...validToken,
      expiryDate: new Date(Date.now() - 1_000),
    };
    prisma.googleToken.findUnique.mockResolvedValue(expiringToken);
    mockRefreshAccessToken.mockRejectedValue({
      response: { data: { error: 'invalid_grant' } },
    });

    await expect(service.hasConflict(userId, start, end)).resolves.toBe(false);

    expect(prisma.googleToken.update).toHaveBeenCalledWith({
      where: { userId },
      data: { isValid: false },
    });
    expect(mockFreebusyQuery).not.toHaveBeenCalled();
  });

  it('returns false without throwing when Google API fails after retries', async () => {
    prisma.googleToken.findUnique.mockResolvedValue(validToken);
    const timeoutError = Object.assign(new Error('timeout'), {
      code: 'ETIMEDOUT',
    });
    mockFreebusyQuery.mockRejectedValue(timeoutError);

    await expect(service.hasConflict(userId, start, end)).resolves.toBe(false);
    expect(mockFreebusyQuery).toHaveBeenCalledTimes(3);
  });

  it('uses google.calendar with mocked client', () => {
    expect(google.calendar).toBeDefined();
  });
});

describe('GoogleService OAuth and connection', () => {
  let service: GoogleService;
  let prisma: {
    googleToken: {
      findUnique: jest.Mock;
      update: jest.Mock;
      upsert: jest.Mock;
      delete: jest.Mock;
    };
  };
  let encryption: {
    encrypt: jest.Mock;
    decrypt: jest.Mock;
    onModuleInit: jest.Mock;
  };

  const userId = 'user-uuid';

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCalendarListWithPrimary();

    process.env.GOOGLE_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
    process.env.GOOGLE_REDIRECT_URI =
      'http://localhost:3001/api/v1/google/callback';
    process.env.ENCRYPTION_KEY = 'b'.repeat(64);
    process.env.APP_BASE_URL = 'http://localhost:3000';

    prisma = {
      googleToken: {
        findUnique: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
    };

    encryption = {
      encrypt: jest.fn((value: string) => `enc:${value}`),
      decrypt: jest.fn((value: string) => value.replace(/^enc:/, '')),
      onModuleInit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleService,
        { provide: PrismaService, useValue: prisma },
        { provide: EncryptionService, useValue: encryption },
      ],
    }).compile();

    service = module.get(GoogleService);
  });

  it('getAuthorizationUrl returns OAuth URL with signed state', () => {
    mockGenerateAuthUrl.mockReturnValue(
      'https://accounts.google.com/o/oauth2/auth?state=signed',
    );

    const url = service.getAuthorizationUrl(userId);

    expect(url).toContain('accounts.google.com');
    expect(mockGenerateAuthUrl).toHaveBeenCalledTimes(1);
    const authUrlCall = (
      mockGenerateAuthUrl.mock.calls as unknown as [
        {
          access_type: string;
          prompt: string;
          scope: string[];
          state: string;
        },
      ]
    )[0];
    expect(authUrlCall.access_type).toBe('offline');
    expect(authUrlCall.prompt).toBe('consent');
    expect(authUrlCall.scope).toEqual(
      expect.arrayContaining([
        'https://www.googleapis.com/auth/calendar.freebusy',
        'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
      ]),
    );
    expect(authUrlCall.state).toEqual(expect.any(String));
  });

  it('handleOAuthCallback stores encrypted tokens and returns success redirect', async () => {
    const state = signOAuthState(userId);

    mockGetToken.mockResolvedValue({
      tokens: {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expiry_date: Date.now() + 3_600_000,
        scope: 'https://www.googleapis.com/auth/calendar.freebusy',
      },
    });

    const redirectUrl = await service.handleOAuthCallback('auth-code', state);

    expect(redirectUrl).toBe(
      'http://localhost:3000/dashboard/google-connected',
    );
    expect(prisma.googleToken.upsert).toHaveBeenCalled();
    expect(encryption.encrypt).toHaveBeenCalledWith('access-token');
    expect(encryption.encrypt).toHaveBeenCalledWith('refresh-token');
  });

  it('getConnectionStatus returns disconnected when no token exists', async () => {
    prisma.googleToken.findUnique.mockResolvedValue(null);

    await expect(service.getConnectionStatus(userId)).resolves.toEqual({
      connected: false,
      isValid: false,
      syncHealthy: false,
    });
  });

  it('getConnectionStatus returns sync health after probing Google Calendar', async () => {
    prisma.googleToken.findUnique.mockResolvedValue({
      userId,
      accessToken: 'enc-access',
      refreshToken: 'enc-refresh',
      expiryDate: new Date(Date.now() + 60 * 60 * 1_000),
      isValid: true,
    });
    mockFreebusyQuery.mockResolvedValue({
      data: { calendars: { primary: { busy: [] } } },
    });

    await expect(service.getConnectionStatus(userId)).resolves.toEqual({
      connected: true,
      isValid: true,
      syncHealthy: true,
      syncError: undefined,
    });
  });

  it('getConnectionStatus reports sync error when Google API fails', async () => {
    prisma.googleToken.findUnique.mockResolvedValue({
      userId,
      accessToken: 'enc-access',
      refreshToken: 'enc-refresh',
      expiryDate: new Date(Date.now() + 60 * 60 * 1_000),
      isValid: true,
    });
    mockFreebusyQuery.mockRejectedValue(
      new Error(
        'Google Calendar API has not been used in project 123 before or it is disabled.',
      ),
    );

    const status = await service.getConnectionStatus(userId);

    expect(status).toMatchObject({
      connected: true,
      isValid: true,
      syncHealthy: false,
    });
    expect(status.syncError).toContain(
      'Google Calendar API no está habilitada',
    );
  });

  it('disconnect revokes token and deletes row', async () => {
    prisma.googleToken.findUnique.mockResolvedValue({
      userId,
      refreshToken: 'enc:refresh-token',
    });
    mockRevokeToken.mockResolvedValue(undefined);

    await service.disconnect(userId);

    expect(mockRevokeToken).toHaveBeenCalledWith('refresh-token');
    expect(prisma.googleToken.delete).toHaveBeenCalledWith({
      where: { userId },
    });
  });

  it('disconnect throws NotFoundException when not connected', async () => {
    prisma.googleToken.findUnique.mockResolvedValue(null);

    await expect(service.disconnect(userId)).rejects.toMatchObject({
      name: 'NotFoundException',
    });
  });

  it('getBusyBlocks returns sync error when token decryption fails', async () => {
    prisma.googleToken.findUnique.mockResolvedValue({
      userId,
      accessToken: 'bad-ciphertext',
      refreshToken: 'bad-ciphertext',
      expiryDate: new Date(Date.now() + 3_600_000),
      isValid: true,
    });
    encryption.decrypt.mockImplementation(() => {
      throw new Error('decrypt failed');
    });

    const result = await service.getBusyBlocks(
      userId,
      new Date('2026-07-01T10:00:00.000Z'),
      new Date('2026-07-01T11:00:00.000Z'),
    );

    expect(result.blocks).toEqual([]);
    expect(result.syncError).toMatch(/conect/i);
  });
});
