import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ChromeHistoryService } from './chrome-history.service';
import { SessionSplitterService } from './session-splitter.service';
import { LlmService } from './llm.service';

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
  ) {
    this.enabled = this.configService.get<string>('BROWSER_COLLECTOR_ENABLED') === 'true';
  }

  /**
   * 1時間ごとにブラウザ履歴を収集し、Fact として保存する
   */
  @Cron('0 */1 * * *', { name: 'browser-collector' })
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
        return;
      }

      // 1. Chrome History DB から新しい訪問を取得
      const visits = this.chromeHistory.fetchNewVisits();
      if (visits.length === 0) {
        this.logger.log('新しい訪問履歴はありません');
        return;
      }

      // 2. セッション分割
      const allSessions = this.sessionSplitter.splitIntoSessions(visits);
      if (allSessions.length === 0) {
        this.logger.log('有効なセッションがありません（訪問数が少なすぎます）');
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
    } catch (error) {
      this.logger.error('ブラウザ履歴収集に失敗しました', error);
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
