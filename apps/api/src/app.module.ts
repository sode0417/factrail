import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { BackupModule } from './backup/backup.module';
import { FactsModule } from './facts/facts.module';
import { HealthModule } from './health/health.module';
import { CryptoModule } from './common/crypto';
import { IntegrationsModule } from './integrations/integrations.module';
import { SettingsModule } from './settings/settings.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { RepositoriesModule } from './repositories/repositories.module';
import { SlackCollectorModule } from './slack-collector/slack-collector.module';

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
    // スケジュールタスク（cronジョブ）のグローバル設定
    ScheduleModule.forRoot(),
    AuthModule,
    BackupModule,
    CryptoModule,
    FactsModule,
    HealthModule,
    IntegrationsModule,
    RepositoriesModule,
    SettingsModule,
    SlackCollectorModule,
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
