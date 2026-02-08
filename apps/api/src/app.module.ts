import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
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
    // グローバルレート制限設定
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1秒
        limit: 3, // 1秒に3リクエストまで
      },
      {
        name: 'medium',
        ttl: 10000, // 10秒
        limit: 20, // 10秒に20リクエストまで
      },
      {
        name: 'long',
        ttl: 60000, // 1分
        limit: 100, // 1分に100リクエストまで
      },
    ]),
    // Redis + Bull Queue のグローバル設定
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get('REDIS_URL') || 'redis://localhost:6379';

        return {
          redis: {
            url: redisUrl,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            // TLS設定（RailwayのRedisはTLSを使用）
            tls: redisUrl.startsWith('rediss://') ? {} : undefined,
          },
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    CryptoModule,
    DispatchersModule,
    FactsModule,
    HealthModule,
    IntegrationsModule,
    SettingsModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    // グローバルレート制限ガード
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
