import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { SettingsModule } from '../settings/settings.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [SettingsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, PrismaService],
})
export class WebhooksModule {}
