import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { CALENDAR_CONFLICT_CHECKER } from '../src/google/google.types';
import { PrismaService } from '../src/prisma/prisma.service';
import { BookingsService } from '../src/bookings/bookings.service';

const API_ROOT = path.resolve(__dirname, '..');

describe('BookingsService (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let service: BookingsService;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('booking_test')
      .withUsername('test')
      .withPassword('test')
      .start();

    const databaseUrl = container.getConnectionUri();
    process.env.DATABASE_URL = databaseUrl;

    execSync('npx prisma migrate deploy', {
      cwd: API_ROOT,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });

    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    const calendarConflictChecker = {
      hasConflict: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: CALENDAR_CONFLICT_CHECKER,
          useValue: calendarConflictChecker,
        },
      ],
    }).compile();

    service = module.get(BookingsService);

    const userA = await prisma.user.create({
      data: {
        auth0Id: 'auth0|user-a',
        email: 'user-a@example.com',
        name: 'User A',
      },
    });
    const userB = await prisma.user.create({
      data: {
        auth0Id: 'auth0|user-b',
        email: 'user-b@example.com',
        name: 'User B',
      },
    });

    userAId = userA.id;
    userBId = userB.id;
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  beforeEach(async () => {
    await prisma.bookingIdempotency.deleteMany();
    await prisma.booking.deleteMany();
  });

  function futureSlot(hoursFromNow = 24) {
    const start = new Date(Date.now() + hoursFromNow * 60 * 60 * 1_000);
    const end = new Date(start.getTime() + 60 * 60 * 1_000);
    return {
      title: 'Integration test booking',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    };
  }

  it('allows only one of two concurrent creates for the same slot', async () => {
    const dto = futureSlot(48);

    const results = await Promise.allSettled([
      service.create(userAId, dto),
      service.create(userAId, dto),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const failure = rejected[0];
    expect(failure.reason).toBeInstanceOf(ConflictException);
    expect((failure.reason as ConflictException).message).toMatch(
      /conflictúa|confirmó primero/i,
    );

    const count = await prisma.booking.count({
      where: { userId: userAId, status: 'CONFIRMED' },
    });
    expect(count).toBe(1);
  });

  it('prevents a user from cancelling another users booking', async () => {
    const created = await service.create(userAId, futureSlot(72));

    await expect(service.cancel(userBId, created.id)).rejects.toMatchObject({
      name: 'ForbiddenException',
    });
  });
});
