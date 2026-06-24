import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import {
  THROTTLE_DEFAULT_LIMIT,
  THROTTLE_DEFAULT_TTL_MS,
} from './common/constants/throttle.constants';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { EncryptionModule } from './encryption/encryption.module';
import { GoogleModule } from './google/google.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: THROTTLE_DEFAULT_TTL_MS,
          limit: THROTTLE_DEFAULT_LIMIT,
        },
      ],
    }),
    PrismaModule,
    EncryptionModule,
    AuthModule,
    UsersModule,
    GoogleModule,
    BookingsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
