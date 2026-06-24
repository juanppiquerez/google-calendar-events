jest.mock('googleapis', () => {
  const mockFreebusyQuery = jest.fn();
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
      })),
    },
    __mocks: {
      mockFreebusyQuery,
      mockRefreshAccessToken,
      mockGenerateAuthUrl,
      mockGetToken,
      mockRevokeToken,
      mockSetCredentials,
      OAuth2,
    },
  };
});

import { Test, TestingModule } from '@nestjs/testing';
import { google } from 'googleapis';
import { EncryptionService } from '../encryption/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleService } from './google.service';

const {
  mockFreebusyQuery,
  mockRefreshAccessToken,
} = jest.requireMock<{
  __mocks: {
    mockFreebusyQuery: jest.Mock;
    mockRefreshAccessToken: jest.Mock;
  };
}>('googleapis').__mocks;

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

    process.env.GOOGLE_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3001/api/v1/google/callback';
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
    const timeoutError = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
    mockFreebusyQuery.mockRejectedValue(timeoutError);

    await expect(service.hasConflict(userId, start, end)).resolves.toBe(false);
    expect(mockFreebusyQuery).toHaveBeenCalledTimes(3);
  });

  it('uses google.calendar with mocked client', () => {
    expect(google.calendar).toBeDefined();
  });
});
