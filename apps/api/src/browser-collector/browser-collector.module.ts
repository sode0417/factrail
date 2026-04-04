import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BrowserCollectorController } from './browser-collector.controller';
import { BrowserCollectorService } from './browser-collector.service';
import { ChromeHistoryService } from './chrome-history.service';
import { SessionSplitterService } from './session-splitter.service';
import { LlmService } from './llm.service';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [AuthModule],
  controllers: [BrowserCollectorController],
  providers: [
    BrowserCollectorService,
    ChromeHistoryService,
    SessionSplitterService,
    LlmService,
    PrismaService,
  ],
})
export class BrowserCollectorModule {}
