import { Module } from '@nestjs/common';
import { SlackCollectorController } from './slack-collector.controller';
import { SlackCollectorService } from './slack-collector.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [SlackCollectorController],
  providers: [SlackCollectorService, PrismaService],
})
export class SlackCollectorModule {}
