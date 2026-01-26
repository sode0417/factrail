import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { SlackOAuthService } from './slack-oauth.service';
import { PrismaService } from '../prisma.service';
import { CryptoService } from '../common/crypto';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, SlackOAuthService, PrismaService, CryptoService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
