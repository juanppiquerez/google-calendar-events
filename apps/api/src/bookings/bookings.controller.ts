import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { AvailabilityQueryDto } from './dto/availability-query.dto';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  async findAll(
    @CurrentUser() authUser: AuthUser,
    @Query('status') status?: BookingStatus,
  ) {
    const user = await this.resolveUser(authUser);
    return this.bookingsService.findAllForUser(user.id, status);
  }

  @Get('availability')
  async getAvailability(
    @CurrentUser() authUser: AuthUser,
    @Query() query: AvailabilityQueryDto,
  ) {
    const user = await this.resolveUser(authUser);
    return this.bookingsService.getAvailability(
      user.id,
      query.date,
      query.timeZone ?? 'UTC',
    );
  }

  @Post()
  async create(
    @CurrentUser() authUser: AuthUser,
    @Body() dto: CreateBookingDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const user = await this.resolveUser(authUser);
    return this.bookingsService.create(user.id, dto, idempotencyKey);
  }

  @Delete(':id')
  async cancel(@CurrentUser() authUser: AuthUser, @Param('id') id: string) {
    const user = await this.resolveUser(authUser);
    return this.bookingsService.cancel(user.id, id);
  }

  private async resolveUser(authUser: AuthUser) {
    return this.usersService.findOrCreateByAuth0Id({
      auth0Id: authUser.sub,
      email: authUser.email ?? `${authUser.sub}@users.auth0`,
      name: authUser.name ?? authUser.email ?? 'User',
    });
  }
}
