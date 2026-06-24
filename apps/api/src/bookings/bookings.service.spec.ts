import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Booking, BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from './bookings.service';

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: {
    booking: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
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
    prisma = {
      booking: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(BookingsService);
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
