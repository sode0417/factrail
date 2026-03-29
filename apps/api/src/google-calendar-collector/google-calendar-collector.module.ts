import { Module } from '@nestjs/common';
import { GoogleCalendarCollectorController } from './google-calendar-collector.controller';
import { GoogleCalendarCollectorService } from './google-calendar-collector.service';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [GoogleCalendarCollectorController],
  providers: [GoogleCalendarCollectorService, PrismaService],
})
export class GoogleCalendarCollectorModule {}
