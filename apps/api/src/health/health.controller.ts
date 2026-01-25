import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/**
 * ヘルスチェックエンドポイント
 * システムの稼働状態を確認する
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

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

    const allHealthy = Object.values(services).every((s) => s === 'healthy');

    return {
      status: allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services,
    };
  }
}
