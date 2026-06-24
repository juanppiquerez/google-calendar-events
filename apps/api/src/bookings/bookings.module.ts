import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GoogleModule } from '../google/google.module';
import { UsersModule } from '../users/users.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [AuthModule, UsersModule, GoogleModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
