import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { SettingsModule } from '../settings/settings.module';
import { DispatchersModule } from '../dispatchers/dispatchers.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [SettingsModule, DispatchersModule, IntegrationsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, PrismaService],
})
export class WebhooksModule {}
