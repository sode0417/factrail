import { Global, Module } from '@nestjs/common';
import { CronHealthService } from './cron-health.service';

/**
 * 各 cron と HealthController が同じインスタンスを共有する必要があるため Global にする
 */
@Global()
@Module({
  providers: [CronHealthService],
  exports: [CronHealthService],
})
export class CronHealthModule {}
