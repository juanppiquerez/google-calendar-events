import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BookingsModule } from './bookings/bookings.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, BookingsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
