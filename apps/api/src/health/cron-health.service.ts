import { Injectable, Logger } from '@nestjs/common';

/**
 * cron ジョブの鮮度の判定結果
 * - healthy: 閾値以内に成功している
 * - pending: プロセス起動から閾値が経っておらず、まだ判定できない（デプロイ直後の誤検知を避けるため）
 * - stale: 閾値を超えて一度も成功していない、または起動後に失敗だけが記録されている
 * - disabled: 設定で無効化されている（Fact が増えないのは正常なので判定しない）
 */
export type CronFreshness = 'healthy' | 'pending' | 'stale' | 'disabled';

export interface CronJobOptions {
  /** 最後の成功（無ければプロセス起動）からこの時間を超えたら stale とみなす */
  staleAfterMs: number;
  enabled: boolean;
}

export interface CronJobStatus {
  status: CronFreshness;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  staleAfterMinutes: number;
}

interface CronJobState extends CronJobOptions {
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  consecutiveFailures: number;
}

/**
 * cron ジョブの成功・失敗を記録し、/health で鮮度を返す
 *
 * cron は例外を握って logger.error するだけなので、失敗し続けてもプロセスは落ちず /health も 200 のまま。
 * better-sqlite3 の ABI 不一致で browser 収集が 7 日間止まっていたのに気づけなかった（#195）。
 * 原因を問わず「成功していない」こと自体を検知するため、各 cron が結果をここへ報告する。
 *
 * 記録はプロセス内のメモリだけに持つ。再起動で消えるので、成功が無い間はプロセス起動時刻を起点に
 * 閾値を数える。ただしデプロイが 1 日 1 回以上あると日次の cron は閾値に届かず、失敗し続けても
 * 見逃す。そのため起動後に成功が無く失敗だけがある場合は、閾値を待たずに stale とする。
 */
@Injectable()
export class CronHealthService {
  private readonly logger = new Logger(CronHealthService.name);
  private readonly jobs = new Map<string, CronJobState>();
  private readonly startedAt = new Date();

  register(name: string, options: CronJobOptions): void {
    this.jobs.set(name, {
      ...options,
      lastSuccessAt: null,
      lastFailureAt: null,
      consecutiveFailures: 0,
    });
  }

  recordSuccess(name: string): void {
    const job = this.getJob(name);
    if (!job) return;
    job.lastSuccessAt = new Date();
    job.consecutiveFailures = 0;
  }

  recordFailure(name: string): void {
    const job = this.getJob(name);
    if (!job) return;
    job.lastFailureAt = new Date();
    job.consecutiveFailures++;
  }

  getStatuses(now: Date = new Date()): Record<string, CronJobStatus> {
    const result: Record<string, CronJobStatus> = {};
    for (const [name, job] of this.jobs) {
      result[name] = {
        status: this.judge(job, now),
        lastSuccessAt: job.lastSuccessAt?.toISOString() ?? null,
        lastFailureAt: job.lastFailureAt?.toISOString() ?? null,
        consecutiveFailures: job.consecutiveFailures,
        staleAfterMinutes: Math.round(job.staleAfterMs / 60000),
      };
    }
    return result;
  }

  private judge(job: CronJobState, now: Date): CronFreshness {
    if (!job.enabled) return 'disabled';
    if (!job.lastSuccessAt && job.consecutiveFailures > 0) return 'stale';
    const elapsed = now.getTime() - (job.lastSuccessAt ?? this.startedAt).getTime();
    if (elapsed <= job.staleAfterMs) {
      return job.lastSuccessAt ? 'healthy' : 'pending';
    }
    return 'stale';
  }

  private getJob(name: string): CronJobState | undefined {
    const job = this.jobs.get(name);
    if (!job) {
      // 登録漏れは実装ミス。黙って捨てると検知の穴になるので警告を残す
      this.logger.warn(`未登録の cron ジョブです: ${name}`);
    }
    return job;
  }
}
