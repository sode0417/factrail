import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CronHealthService } from './cron-health.service';

/**
 * ヘルスチェックエンドポイント
 * システムの稼働状態を確認する
 *
 * status の意味:
 * - ok: すべて正常
 * - degraded: API は応答できるが、cron が閾値を超えて成功していない。デプロイのゲートにはしない
 * - unhealthy: DB に繋がらず API として機能しない。deploy.sh はこれだけを失敗とみなす
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cronHealth: CronHealthService,
  ) {}

  /**
   * システムのヘルスチェックを実行
   * @returns システムの稼働状態
   */
  @Get()
  async check() {
    const services: Record<string, string> = {};

    // データベースの接続チェック
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      services.database = 'healthy';
    } catch {
      services.database = 'unhealthy';
    }

    const crons = this.cronHealth.getStatuses();
    const anyStale = Object.values(crons).some((c) => c.status === 'stale');

    let status: 'ok' | 'degraded' | 'unhealthy' = 'ok';
    if (services.database !== 'healthy') {
      status = 'unhealthy';
    } else if (anyStale) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      services,
      crons,
    };
  }
}
