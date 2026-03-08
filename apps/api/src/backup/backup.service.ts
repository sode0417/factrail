import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';

export interface BackupData {
  metadata: {
    version: string;
    createdAt: string;
    userId: string;
  };
  facts: unknown[];
  integrations: unknown[];
  repositories: unknown[];
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 指定ユーザーのデータをエクスポートしてバックアップデータを生成する
   */
  async createUserBackup(userId: string): Promise<BackupData> {
    const [facts, integrations, repositories] = await Promise.all([
      this.prisma.fact.findMany({
        where: { userId },
        orderBy: { occurredAt: 'desc' },
      }),
      this.prisma.integration.findMany({
        where: { userId },
        select: {
          id: true,
          provider: true,
          accountId: true,
          accountName: true,
          status: true,
          lastSyncAt: true,
          createdAt: true,
          updatedAt: true,
          // accessToken / refreshToken は除外（機密情報）
        },
      }),
      this.prisma.repository.findMany({
        where: { integration: { userId } },
        select: {
          id: true,
          owner: true,
          name: true,
          fullName: true,
          isPrivate: true,
          status: true,
          lastEventAt: true,
          createdAt: true,
          updatedAt: true,
          // webhookId は除外（機密情報）
        },
      }),
    ]);

    return {
      metadata: {
        version: '1.0',
        createdAt: new Date().toISOString(),
        userId,
      },
      facts,
      integrations,
      repositories,
    };
  }

  /**
   * 毎日深夜2時にシステム全体のバックアップサマリーをログ出力する
   * 本番環境では外部ストレージ（S3等）への保存を推奨
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledBackup(): Promise<void> {
    this.logger.log('スケジュールバックアップ開始');

    try {
      const [factCount, integrationCount, repositoryCount, userCount] = await Promise.all([
        this.prisma.fact.count(),
        this.prisma.integration.count(),
        this.prisma.repository.count(),
        this.prisma.user.count(),
      ]);

      this.logger.log(
        `バックアップ完了: users=${userCount}, facts=${factCount}, integrations=${integrationCount}, repositories=${repositoryCount}`,
      );
    } catch (error) {
      this.logger.error('スケジュールバックアップ失敗', error);
    }
  }
}
