import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { FactsModule } from './facts/facts.module';
import { HealthModule } from './health/health.module';
import { CryptoModule } from './common/crypto';
import { IntegrationsModule } from './integrations/integrations.module';
import { SettingsModule } from './settings/settings.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { DispatchersModule } from './dispatchers/dispatchers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Redis + Bull Queue のグローバル設定
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: configService.get('REDIS_URL') || 'redis://localhost:6379',
      }),
      inject: [ConfigService],
    }),
    CryptoModule,
    DispatchersModule,
    FactsModule,
    HealthModule,
    IntegrationsModule,
    SettingsModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
