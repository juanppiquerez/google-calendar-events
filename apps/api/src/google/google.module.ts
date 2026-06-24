import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { GoogleController } from './google.controller';
import { GoogleService } from './google.service';
import { CALENDAR_CONFLICT_CHECKER } from './google.types';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [GoogleController],
  providers: [
    GoogleService,
    {
      provide: CALENDAR_CONFLICT_CHECKER,
      useExisting: GoogleService,
    },
  ],
  exports: [GoogleService, CALENDAR_CONFLICT_CHECKER],
})
export class GoogleModule {}
