import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthUser } from '../src/auth/auth-user.interface';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { BookingsController } from '../src/bookings/bookings.controller';
import { BookingsService } from '../src/bookings/bookings.service';
import { GOOGLE_CALENDAR_CONFLICT_MESSAGE } from '../src/google/google.constants';
import { CALENDAR_CONFLICT_CHECKER } from '../src/google/google.types';
import { PrismaService } from '../src/prisma/prisma.service';
import { UsersService } from '../src/users/users.service';

const API_ROOT = path.resolve(__dirname, '..');

describe('POST /bookings with Google Calendar conflict (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let app: INestApplication<App>;
  let userId: string;

  const mockGoogleService = {
    hasConflict: jest.fn(),
    getBusyBlocks: jest.fn().mockResolvedValue([]),
  };

  const mockAuthUser: AuthUser = {
    sub: 'auth0|google-booking-test',
    email: 'google-test@example.com',
    name: 'Google Test User',
  };

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('booking_google_test')
      .withUsername('test')
      .withPassword('test')
      .start();

    const databaseUrl = container.getConnectionUri();
    process.env.DATABASE_URL = databaseUrl;
    process.env.ENCRYPTION_KEY = 'c'.repeat(64);

    execSync('npx prisma migrate deploy', {
      cwd: API_ROOT,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });

    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        BookingsService,
        UsersService,
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
          req.user = mockAuthUser;
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

    const user = await prisma.user.create({
      data: {
        auth0Id: mockAuthUser.sub,
        email: mockAuthUser.email!,
        name: mockAuthUser.name!,
      },
    });
    userId = user.id;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await container?.stop();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await prisma.bookingIdempotency.deleteMany();
    await prisma.booking.deleteMany();
    mockGoogleService.hasConflict.mockResolvedValue(false);
  });

  function futureSlot(hoursFromNow = 96) {
    const start = new Date(Date.now() + hoursFromNow * 60 * 60 * 1_000);
    const end = new Date(start.getTime() + 60 * 60 * 1_000);
    return {
      title: 'Google conflict test booking',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    };
  }

  it('returns 409 and does not create booking when Google reports a conflict', async () => {
    const dto = futureSlot();
    mockGoogleService.hasConflict.mockResolvedValue(true);

    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send(dto)
      .expect(409);

    expect(response.body.message).toBe(GOOGLE_CALENDAR_CONFLICT_MESSAGE);
    expect(mockGoogleService.hasConflict).toHaveBeenCalledWith(
      userId,
      new Date(dto.startTime),
      new Date(dto.endTime),
    );

    const count = await prisma.booking.count({ where: { userId } });
    expect(count).toBe(0);
  });

  it('creates booking when Google reports no conflict', async () => {
    const dto = futureSlot(120);
    mockGoogleService.hasConflict.mockResolvedValue(false);

    await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send(dto)
      .expect(201);

    const count = await prisma.booking.count({ where: { userId } });
    expect(count).toBe(1);
  });
});
