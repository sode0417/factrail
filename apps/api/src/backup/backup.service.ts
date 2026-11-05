import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { CronHealthService } from '../health/cron-health.service';

const CRON_NAME = 'scheduled-backup';
/** 毎日 1 回なので、1 日分の余裕を持たせる */
const STALE_AFTER_MS = 26 * 60 * 60 * 1000;

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly cronHealth: CronHealthService,
  ) {
    // backup は必要になるまで誰も見ないので、静かに止まるといちばん困る。常に判定対象にする（#195）
    this.cronHealth.register(CRON_NAME, { staleAfterMs: STALE_AFTER_MS, enabled: true });
  }

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
  @Cron(CronExpression.EVERY_DAY_AT_2AM, { name: CRON_NAME })
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
      this.cronHealth.recordSuccess(CRON_NAME);
    } catch (error) {
      this.logger.error('スケジュールバックアップ失敗', error);
      this.cronHealth.recordFailure(CRON_NAME);
    }
  }
}
