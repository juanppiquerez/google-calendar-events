import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthUser } from '../src/auth/auth-user.interface';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { BookingsController } from '../src/bookings/bookings.controller';
import { BookingsService } from '../src/bookings/bookings.service';
import { EncryptionService } from '../src/encryption/encryption.service';
import { GoogleController } from '../src/google/google.controller';
import { GOOGLE_CALENDAR_CONFLICT_MESSAGE } from '../src/google/google.constants';
import { GoogleService } from '../src/google/google.service';
import { CALENDAR_CONFLICT_CHECKER } from '../src/google/google.types';
import { PrismaService } from '../src/prisma/prisma.service';
import { UsersService } from '../src/users/users.service';
import {
  futureSlot,
  setupPostgresTestDatabase,
  teardownPostgresTestDatabase,
  type PostgresTestContext,
} from './helpers/postgres-test-setup';

describe('API endpoints (integration)', () => {
  let ctx: PostgresTestContext;
  let prisma: PrismaClient;
  let app: INestApplication<App>;
  let userAId: string;
  let userBId: string;

  const mockAuthUserA: AuthUser = {
    sub: 'auth0|user-a',
    email: 'user-a@example.com',
    name: 'User A',
  };

  const mockAuthUserB: AuthUser = {
    sub: 'auth0|user-b',
    email: 'user-b@example.com',
    name: 'User B',
  };

  const mockGoogleService = {
    hasConflict: jest.fn(),
    getBusyBlocks: jest.fn().mockResolvedValue({ blocks: [] }),
    getAuthorizationUrl: jest.fn(),
    handleOAuthCallback: jest.fn(),
    getConnectionStatus: jest.fn(),
    disconnect: jest.fn(),
  };

  let currentAuthUser = mockAuthUserA;

  beforeAll(async () => {
    ctx = await setupPostgresTestDatabase();
    prisma = ctx.prisma;
    process.env.ENCRYPTION_KEY = 'd'.repeat(64);
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3001/api/v1/google/callback';
    process.env.APP_BASE_URL = 'http://localhost:3000';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController, GoogleController],
      providers: [
        BookingsService,
        UsersService,
        GoogleService,
        EncryptionService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: CALENDAR_CONFLICT_CHECKER,
          useValue: mockGoogleService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { user?: AuthUser } };
        }) => {
          const req = context.switchToHttp().getRequest();
          req.user = currentAuthUser;
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );
    app.setGlobalPrefix('api/v1');
    await app.init();

    const encryptionService = app.get(EncryptionService);
    encryptionService.onModuleInit();

    const userA = await prisma.user.findUnique({
      where: { auth0Id: mockAuthUserA.sub },
    });
    const userB = await prisma.user.findUnique({
      where: { auth0Id: mockAuthUserB.sub },
    });

    if (!userA || !userB) {
      const createdA = await prisma.user.upsert({
        where: { auth0Id: mockAuthUserA.sub },
        create: {
          auth0Id: mockAuthUserA.sub,
          email: mockAuthUserA.email!,
          name: mockAuthUserA.name!,
        },
        update: {},
      });
      const createdB = await prisma.user.upsert({
        where: { auth0Id: mockAuthUserB.sub },
        create: {
          auth0Id: mockAuthUserB.sub,
          email: mockAuthUserB.email!,
          name: mockAuthUserB.name!,
        },
        update: {},
      });
      userAId = createdA.id;
      userBId = createdB.id;
    } else {
      userAId = userA.id;
      userBId = userB.id;
    }
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await teardownPostgresTestDatabase(ctx);
  });

  beforeEach(async () => {
    currentAuthUser = mockAuthUserA;
    jest.clearAllMocks();
    mockGoogleService.hasConflict.mockResolvedValue(false);
    mockGoogleService.getBusyBlocks.mockResolvedValue({ blocks: [] });
    mockGoogleService.getAuthorizationUrl.mockReturnValue(
      'https://accounts.google.com/o/oauth2/auth?test=1',
    );
    mockGoogleService.getConnectionStatus.mockImplementation(async (userId: string) => {
      const token = await prisma.googleToken.findUnique({ where: { userId } });
      if (!token) return { connected: false, isValid: false, syncHealthy: false };
      return { connected: true, isValid: token.isValid, syncHealthy: token.isValid };
    });
    mockGoogleService.disconnect.mockImplementation(async (userId: string) => {
      await prisma.googleToken.deleteMany({ where: { userId } });
    });

    await prisma.bookingIdempotency.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.googleToken.deleteMany();
  });

  describe('POST /bookings', () => {
    it('creates a booking successfully', async () => {
      const dto = futureSlot(72);

      const response = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .send(dto)
        .expect(201);

      expect(response.body.title).toBe(dto.title);
      expect(response.body.status).toBe('CONFIRMED');
    });

    it('returns 409 for internal overlap', async () => {
      const dto = futureSlot(96);
      await request(app.getHttpServer()).post('/api/v1/bookings').send(dto).expect(201);

      const response = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .send(dto)
        .expect(409);

      expect(response.body.message).toMatch(/conflictúa/i);
    });

    it('returns 409 when Google reports a conflict', async () => {
      const dto = futureSlot(120);
      mockGoogleService.hasConflict.mockResolvedValue(true);

      const response = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .send(dto)
        .expect(409);

      expect(response.body.message).toBe(GOOGLE_CALENDAR_CONFLICT_MESSAGE);
    });
  });

  describe('GET /bookings', () => {
    it('lists bookings for the authenticated user', async () => {
      const dto = futureSlot(144);
      await request(app.getHttpServer()).post('/api/v1/bookings').send(dto).expect(201);

      const response = await request(app.getHttpServer())
        .get('/api/v1/bookings')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe(dto.title);
    });
  });

  describe('DELETE /bookings/:id', () => {
    it('cancels own booking', async () => {
      const dto = futureSlot(168);
      const created = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .send(dto)
        .expect(201);

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/bookings/${created.body.id}`)
        .expect(200);

      expect(response.body.message).toBe('Booking cancelled successfully');
      expect(response.body.booking.status).toBe('CANCELLED');
    });

    it('returns 403 when cancelling another users booking', async () => {
      const dto = futureSlot(192);
      const created = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .send(dto)
        .expect(201);

      currentAuthUser = mockAuthUserB;

      await request(app.getHttpServer())
        .delete(`/api/v1/bookings/${created.body.id}`)
        .expect(403);
    });

    it('is idempotent when booking is already cancelled', async () => {
      const dto = futureSlot(216);
      const created = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .send(dto)
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/v1/bookings/${created.body.id}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/bookings/${created.body.id}`)
        .expect(200);

      expect(response.body.message).toBe('Booking is already cancelled');
    });
  });

  describe('Google Calendar endpoints', () => {
    it('GET /google/connect returns authorization URL', async () => {
      const realGoogleService = app.get(GoogleService);
      jest
        .spyOn(realGoogleService, 'getAuthorizationUrl')
        .mockReturnValue('https://accounts.google.com/o/oauth2/auth?state=test');

      const response = await request(app.getHttpServer())
        .get('/api/v1/google/connect')
        .expect(200);

      expect(response.body.url).toContain('accounts.google.com');
    });

    it('GET /google/status returns disconnected by default', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/google/status')
        .expect(200);

      expect(response.body).toEqual({
        connected: false,
        isValid: false,
        syncHealthy: false,
      });
    });

    it('GET /google/status returns connected after token is stored', async () => {
      await prisma.googleToken.create({
        data: {
          userId: userAId,
          accessToken: 'enc-access',
          refreshToken: 'enc-refresh',
          expiryDate: new Date(Date.now() + 3_600_000),
          scope: 'https://www.googleapis.com/auth/calendar.freebusy',
          isValid: true,
        },
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/google/status')
        .expect(200);

      expect(response.body).toEqual({
        connected: true,
        isValid: true,
        syncHealthy: true,
      });
    });

    it('DELETE /google/disconnect removes token', async () => {
      await prisma.googleToken.create({
        data: {
          userId: userAId,
          accessToken: 'enc-access',
          refreshToken: 'enc-refresh',
          expiryDate: new Date(Date.now() + 3_600_000),
          scope: 'https://www.googleapis.com/auth/calendar.freebusy',
          isValid: true,
        },
      });

      const realGoogleService = app.get(GoogleService);
      jest.spyOn(realGoogleService, 'disconnect').mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete('/api/v1/google/disconnect')
        .expect(200);

      expect(realGoogleService.disconnect).toHaveBeenCalled();
    });
  });
});
