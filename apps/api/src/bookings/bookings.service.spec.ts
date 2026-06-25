import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Booking, BookingStatus } from '@prisma/client';
import { GOOGLE_CALENDAR_CONFLICT_MESSAGE } from '../google/google.constants';
import { CALENDAR_CONFLICT_CHECKER } from '../google/google.types';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from './bookings.service';

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: {
    booking: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    googleToken: {
      findUnique: jest.Mock;
    };
    bookingIdempotency: {
      findFirst: jest.Mock;
      create: jest.Mock;
    };
  };

  const calendarConflictChecker = {
    hasConflict: jest.fn().mockResolvedValue(false),
    getBusyBlocks: jest.fn().mockResolvedValue({ blocks: [] }),
  };

  const ownerId = 'owner-uuid';
  const otherUserId = 'other-uuid';

  const confirmedBooking: Booking = {
    id: 'booking-uuid',
    userId: ownerId,
    title: 'Team sync',
    startTime: new Date('2026-07-01T10:00:00.000Z'),
    endTime: new Date('2026-07-01T11:00:00.000Z'),
    status: BookingStatus.CONFIRMED,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    calendarConflictChecker.hasConflict.mockReset().mockResolvedValue(false);
    calendarConflictChecker.getBusyBlocks.mockReset().mockResolvedValue({ blocks: [] });

    prisma = {
      booking: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      googleToken: {
        findUnique: jest.fn(),
      },
      bookingIdempotency: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
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
  });

  describe('create', () => {
    const dto = {
      title: 'New meeting',
      startTime: '2026-08-01T10:00:00.000Z',
      endTime: '2026-08-01T11:00:00.000Z',
    };

    it('throws ConflictException when an internal booking overlaps', async () => {
      prisma.bookingIdempotency.findFirst.mockResolvedValue(null);
      prisma.booking.findFirst.mockResolvedValue(confirmedBooking);

      await expect(service.create(ownerId, dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(calendarConflictChecker.hasConflict).not.toHaveBeenCalled();
    });

    it('throws ConflictException when Google Calendar reports a conflict', async () => {
      prisma.bookingIdempotency.findFirst.mockResolvedValue(null);
      prisma.booking.findFirst.mockResolvedValue(null);
      calendarConflictChecker.hasConflict.mockResolvedValue(true);

      await expect(service.create(ownerId, dto)).rejects.toMatchObject({
        message: GOOGLE_CALENDAR_CONFLICT_MESSAGE,
      });
      expect(prisma.booking.create).not.toHaveBeenCalled();
    });

    it('creates a booking when no conflicts exist', async () => {
      prisma.bookingIdempotency.findFirst.mockResolvedValue(null);
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.create.mockResolvedValue({
        ...confirmedBooking,
        title: dto.title,
      });

      const result = await service.create(ownerId, dto);

      expect(result.title).toBe(dto.title);
      expect(prisma.booking.create).toHaveBeenCalled();
    });

    it('returns cached response for idempotency key replay', async () => {
      const cached = {
        id: 'cached-id',
        userId: ownerId,
        title: dto.title,
        startTime: dto.startTime,
        endTime: dto.endTime,
        status: BookingStatus.CONFIRMED,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      prisma.bookingIdempotency.findFirst.mockResolvedValue({
        responseBody: cached,
      });

      const result = await service.create(ownerId, dto, 'idem-key-1');

      expect(result).toEqual(cached);
      expect(prisma.booking.create).not.toHaveBeenCalled();
    });
  });

  describe('findAllForUser', () => {
    it('returns bookings ordered by start time', async () => {
      prisma.booking.findMany.mockResolvedValue([confirmedBooking]);

      const result = await service.findAllForUser(ownerId);

      expect(result).toHaveLength(1);
      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: { userId: ownerId },
        orderBy: { startTime: 'asc' },
      });
    });
  });

  describe('getAvailability', () => {
    it('combines internal bookings and Google Calendar busy blocks', async () => {
      prisma.booking.findMany.mockResolvedValue([
        {
          id: 'booking-1',
          userId: ownerId,
          title: 'Team sync',
          startTime: new Date('2026-07-15T14:00:00.000Z'),
          endTime: new Date('2026-07-15T15:00:00.000Z'),
          status: BookingStatus.CONFIRMED,
        },
      ]);
      prisma.googleToken.findUnique.mockResolvedValue({ isValid: true });
      calendarConflictChecker.getBusyBlocks.mockResolvedValue({
        blocks: [
          {
            start: '2026-07-15T16:00:00.000Z',
            end: '2026-07-15T17:00:00.000Z',
          },
        ],
      });

      const result = await service.getAvailability(
        ownerId,
        '2026-07-15',
        'UTC',
      );

      expect(result.date).toBe('2026-07-15');
      expect(result.googleCalendarConnected).toBe(true);
      expect(result.occupiedSlots).toHaveLength(2);
      expect(result.occupiedSlots[0]).toMatchObject({
        source: 'booking',
        title: 'Team sync',
        bookingId: 'booking-1',
      });
      expect(result.occupiedSlots[1]).toMatchObject({
        source: 'google_calendar',
      });
      expect(calendarConflictChecker.getBusyBlocks).toHaveBeenCalled();
    });

    it('skips Google blocks when calendar is not connected', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.googleToken.findUnique.mockResolvedValue(null);

      const result = await service.getAvailability(
        ownerId,
        '2026-07-15',
        'UTC',
      );

      expect(result.googleCalendarConnected).toBe(false);
      expect(result.occupiedSlots).toEqual([]);
      expect(calendarConflictChecker.getBusyBlocks).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('throws NotFoundException when booking does not exist', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);

      await expect(
        service.cancel(ownerId, 'missing-id'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when user does not own the booking', async () => {
      prisma.booking.findUnique.mockResolvedValue(confirmedBooking);

      await expect(
        service.cancel(otherUserId, confirmedBooking.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns idempotent response when booking is already cancelled', async () => {
      const cancelled = {
        ...confirmedBooking,
        status: BookingStatus.CANCELLED,
      };
      prisma.booking.findUnique.mockResolvedValue(cancelled);

      const result = await service.cancel(ownerId, confirmedBooking.id);

      expect(result.message).toBe('Booking is already cancelled');
      expect(result.booking.status).toBe(BookingStatus.CANCELLED);
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });

    it('cancels a confirmed booking owned by the user', async () => {
      prisma.booking.findUnique.mockResolvedValue(confirmedBooking);
      prisma.booking.update.mockResolvedValue({
        ...confirmedBooking,
        status: BookingStatus.CANCELLED,
      });

      const result = await service.cancel(ownerId, confirmedBooking.id);

      expect(result.message).toBe('Booking cancelled successfully');
      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: confirmedBooking.id },
        data: { status: BookingStatus.CANCELLED },
      });
    });
  });
});
