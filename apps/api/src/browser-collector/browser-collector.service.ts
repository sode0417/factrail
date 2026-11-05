import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CronHealthService } from '../health/cron-health.service';
import { ChromeHistoryService } from './chrome-history.service';
import { SessionSplitterService } from './session-splitter.service';
import { LlmService } from './llm.service';

const CRON_NAME = 'browser-collector';
/** 毎時実行なので、2 回続けて成功しなければ stale（一時的な 1 回の失敗では騒がない） */
const STALE_AFTER_MS = 2 * 60 * 60 * 1000 + 15 * 60 * 1000;

@Injectable()
export class BrowserCollectorService {
  private readonly logger = new Logger(BrowserCollectorService.name);
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly chromeHistory: ChromeHistoryService,
    private readonly sessionSplitter: SessionSplitterService,
    private readonly llm: LlmService,
    private readonly cronHealth: CronHealthService,
  ) {
    this.enabled = this.configService.get<string>('BROWSER_COLLECTOR_ENABLED') === 'true';
    this.cronHealth.register(CRON_NAME, { staleAfterMs: STALE_AFTER_MS, enabled: this.enabled });
  }

  /**
   * 1時間ごとにブラウザ履歴を収集し、Fact として保存する
   */
  @Cron('0 */1 * * *', { name: CRON_NAME })
  async collectBrowserHistory(): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('ブラウザ履歴収集は無効化されています');
      return;
    }

    this.logger.log('ブラウザ履歴収集を開始します');

    try {
      const userId = await this.resolveUserId();
      if (!userId) {
        this.logger.warn('ユーザーが見つかりません。収集をスキップします');
        this.cronHealth.recordFailure(CRON_NAME);
        return;
      }

      // 1. Chrome History DB から新しい訪問を取得
      const visits = this.chromeHistory.fetchNewVisits();
      if (visits.length === 0) {
        this.logger.log('新しい訪問履歴はありません');
        this.cronHealth.recordSuccess(CRON_NAME);
        return;
      }

      // 2. セッション分割
      const allSessions = this.sessionSplitter.splitIntoSessions(visits);
      if (allSessions.length === 0) {
        this.logger.log('有効なセッションがありません（訪問数が少なすぎます）');
        this.cronHealth.recordSuccess(CRON_NAME);
        return;
      }

      // 1回の実行で処理するセッション数を制限（直近のものを優先）
      const MAX_SESSIONS_PER_RUN = 20;
      const sessions =
        allSessions.length > MAX_SESSIONS_PER_RUN
          ? allSessions.slice(-MAX_SESSIONS_PER_RUN)
          : allSessions;

      if (allSessions.length > MAX_SESSIONS_PER_RUN) {
        this.logger.log(
          `${allSessions.length} セッション中、直近 ${MAX_SESSIONS_PER_RUN} 件を処理します`,
        );
      }

      // 3. 各セッションを LLM で要約し、Fact として保存
      let savedCount = 0;
      for (const session of sessions) {
        try {
          const summary = await this.llm.summarizeSession(session);

          await this.upsertFact(userId, {
            externalId: `chrome:default:${Math.floor(session.startTime.getTime() / 1000)}`,
            source: 'browser',
            type: 'browser.research',
            occurredAt: session.startTime,
            title: summary.title,
            summary: summary.summary,
            sourceUrl: session.primaryUrl,
            metadata: {
              domains: session.domains,
              visit_count: session.visitCount,
              duration_min: session.durationMin,
              search_queries: session.searchQueries,
              urls: session.visits.map((v) => ({
                url: v.url,
                title: v.title,
              })),
            },
          });

          savedCount++;
        } catch (error) {
          this.logger.error(
            `セッション（${session.startTime.toISOString()}）の保存に失敗しました`,
            error,
          );
        }
      }

      this.logger.log(
        `ブラウザ履歴収集完了: ${savedCount}/${sessions.length} セッションを保存しました`,
      );

      // 1 件も保存できなければ LLM や DB が全滅している。セッション単位の catch で握られるので、ここで失敗扱いにする
      if (savedCount === 0) {
        this.cronHealth.recordFailure(CRON_NAME);
      } else {
        this.cronHealth.recordSuccess(CRON_NAME);
      }
    } catch (error) {
      this.logger.error('ブラウザ履歴収集に失敗しました', error);
      this.cronHealth.recordFailure(CRON_NAME);
    }
  }

  private async resolveUserId(): Promise<string | null> {
    const user = await this.prisma.user.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  private async upsertFact(
    userId: string,
    data: {
      externalId: string;
      source: string;
      type: string;
      occurredAt: Date;
      title: string;
      summary: string | null;
      sourceUrl: string;
      metadata: Record<string, unknown>;
    },
  ) {
    return this.prisma.fact.upsert({
      where: {
        source_externalId: {
          source: data.source,
          externalId: data.externalId,
        },
      },
      create: {
        userId,
        externalId: data.externalId,
        source: data.source,
        occurredAt: data.occurredAt,
        title: data.title,
        summary: data.summary,
        sourceUrl: data.sourceUrl,
        raw: Prisma.JsonNull,
        type: data.type,
        metadata: data.metadata as Prisma.InputJsonValue,
      },
      update: {
        title: data.title,
        summary: data.summary,
        sourceUrl: data.sourceUrl,
        metadata: data.metadata as Prisma.InputJsonValue,
      },
    });
  }
}
