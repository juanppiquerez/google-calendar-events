import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BookingResponse, toBookingResponse } from './booking.mapper';
import { CreateBookingDto } from './dto/create-booking.dto';
import { isExclusionViolation } from './postgres-errors';

/** Idempotency keys are honored for this window after the original request. */
export const IDEMPOTENCY_TTL_MINUTES = 10;

const INTERNAL_CONFLICT_MESSAGE =
  'El horario conflictúa con una reserva interna existente';
const RACE_CONFLICT_MESSAGE =
  'Otra reserva se confirmó primero, elegí otro horario';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForUser(
    userId: string,
    status?: BookingStatus,
  ): Promise<BookingResponse[]> {
    const bookings = await this.prisma.booking.findMany({
      where: {
        userId,
        ...(status ? { status } : {}),
      },
      orderBy: { startTime: 'asc' },
    });

    return bookings.map(toBookingResponse);
  }

  async create(
    userId: string,
    dto: CreateBookingDto,
    idempotencyKey?: string,
  ): Promise<BookingResponse> {
    if (idempotencyKey) {
      const cached = await this.findIdempotentResponse(userId, idempotencyKey);
      if (cached) {
        return cached;
      }
    }

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    const conflicting = await this.prisma.booking.findFirst({
      where: {
        userId,
        status: BookingStatus.CONFIRMED,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });

    if (conflicting) {
      throw new ConflictException(INTERNAL_CONFLICT_MESSAGE);
    }

    try {
      const booking = await this.prisma.booking.create({
        data: {
          userId,
          title: dto.title,
          startTime,
          endTime,
        },
      });

      const response = toBookingResponse(booking);

      if (idempotencyKey) {
        await this.storeIdempotentResponse(userId, idempotencyKey, response);
      }

      return response;
    } catch (error) {
      if (isExclusionViolation(error)) {
        throw new ConflictException(RACE_CONFLICT_MESSAGE);
      }

      throw error;
    }
  }

  async cancel(
    userId: string,
    bookingId: string,
  ): Promise<{ message: string; booking: BookingResponse }> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to cancel this booking',
      );
    }

    if (booking.status === BookingStatus.CANCELLED) {
      return {
        message: 'Booking is already cancelled',
        booking: toBookingResponse(booking),
      };
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED },
    });

    return {
      message: 'Booking cancelled successfully',
      booking: toBookingResponse(updated),
    };
  }

  private async findIdempotentResponse(
    userId: string,
    idempotencyKey: string,
  ): Promise<BookingResponse | null> {
    const cutoff = new Date(Date.now() - IDEMPOTENCY_TTL_MINUTES * 60 * 1_000);

    const record = await this.prisma.bookingIdempotency.findFirst({
      where: {
        userId,
        idempotencyKey,
        createdAt: { gte: cutoff },
      },
    });

    if (!record) {
      return null;
    }

    return record.responseBody as unknown as BookingResponse;
  }

  private async storeIdempotentResponse(
    userId: string,
    idempotencyKey: string,
    response: BookingResponse,
  ): Promise<void> {
    try {
      await this.prisma.bookingIdempotency.create({
        data: {
          userId,
          idempotencyKey,
          responseBody: response as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const cached = await this.findIdempotentResponse(
          userId,
          idempotencyKey,
        );
        if (cached) {
          return;
        }
      }

      throw error;
    }
  }
}
