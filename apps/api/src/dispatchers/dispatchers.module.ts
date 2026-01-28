import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SlackDispatcherService } from './slack-dispatcher.service';
import { SlackDispatcherProcessor } from './slack-dispatcher.processor';
import { IntegrationsModule } from '../integrations/integrations.module';
import { SettingsModule } from '../settings/settings.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [
    IntegrationsModule,
    SettingsModule,
    BullModule.registerQueue({
      name: 'slack-dispatch',
      limiter: {
        max: 1, // 1秒あたり1件
        duration: 1000,
      },
    }),
  ],
  providers: [SlackDispatcherService, SlackDispatcherProcessor, PrismaService],
  exports: [BullModule],
})
export class DispatchersModule {}
