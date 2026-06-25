import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { CALENDAR_CONFLICT_CHECKER } from '../src/google/google.types';
import { PrismaService } from '../src/prisma/prisma.service';
import { BookingsService } from '../src/bookings/bookings.service';
import {
  setupPostgresTestDatabase,
  teardownPostgresTestDatabase,
  type PostgresTestContext,
} from './helpers/postgres-test-setup';

describe('BookingsService (integration)', () => {
  let ctx: PostgresTestContext;
  let prisma: PrismaClient;
  let service: BookingsService;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    ctx = await setupPostgresTestDatabase();
    prisma = ctx.prisma;

    const calendarConflictChecker = {
      hasConflict: jest.fn().mockResolvedValue(false),
      getBusyBlocks: jest.fn().mockResolvedValue({ blocks: [] }),
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
    await teardownPostgresTestDatabase(ctx);
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

  it('returns occupied slots from internal bookings for a day', async () => {
    const dto = futureSlot(48);
    await service.create(userAId, dto);

    const date = dto.startTime.slice(0, 10);
    const availability = await service.getAvailability(userAId, date, 'UTC');

    expect(availability.occupiedSlots).toHaveLength(1);
    expect(availability.occupiedSlots[0]).toMatchObject({
      source: 'booking',
      title: dto.title,
    });
    expect(availability.googleCalendarConnected).toBe(false);
  });

  it('includes Google Calendar busy blocks when connected', async () => {
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

    const calendarConflictChecker = {
      hasConflict: jest.fn().mockResolvedValue(false),
      getBusyBlocks: jest.fn().mockResolvedValue({
        blocks: [
          {
            start: '2026-07-20T10:00:00.000Z',
            end: '2026-07-20T11:00:00.000Z',
          },
        ],
      }),
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

    const availabilityService = module.get(BookingsService);
    const availability = await availabilityService.getAvailability(
      userAId,
      '2026-07-20',
      'UTC',
    );

    expect(availability.googleCalendarConnected).toBe(true);
    expect(availability.occupiedSlots).toEqual([
      {
        startTime: '2026-07-20T10:00:00.000Z',
        endTime: '2026-07-20T11:00:00.000Z',
        source: 'google_calendar',
      },
    ]);
  });
});
