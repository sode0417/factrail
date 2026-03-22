import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { WebClient } from '@slack/web-api';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SlackCollectorService {
  private readonly logger = new Logger(SlackCollectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 毎日 JST 21:00 (UTC 12:00) に Slack DM メッセージを収集
   */
  @Cron('0 12 * * *', { name: 'slack-collector' })
  async collectSlackMessages(): Promise<void> {
    const token = this.configService.get<string>('SLACK_BOT_TOKEN_WORK');
    const slackUserId = this.configService.get<string>('SLACK_USER_ID_WORK');
    const defaultCategoryId = this.configService.get<string>('SLACK_COLLECTOR_CATEGORY_ID');
    const defaultProjectId = this.configService.get<string>('SLACK_COLLECTOR_PROJECT_ID');

    if (!token || !slackUserId) {
      this.logger.debug(
        'SLACK_BOT_TOKEN_WORK または SLACK_USER_ID_WORK が未設定のため、Slack収集をスキップします',
      );
      return;
    }

    this.logger.log('Slack DM メッセージ収集を開始します');

    try {
      const client = new WebClient(token);

      // Bot の team_id を取得
      const authResult = await client.auth.test();
      const teamId = authResult.team_id;

      if (!teamId) {
        this.logger.error('Slack team_id を取得できませんでした');
        return;
      }

      // DM チャンネルを開く
      const dmResult = await client.conversations.open({ users: slackUserId });
      const channelId = dmResult.channel?.id;

      if (!channelId) {
        this.logger.error('Slack DM チャンネルを開けませんでした');
        return;
      }

      // 当日 JST 0:00〜翌日 0:00 の範囲を計算
      const { oldest, latest } = this.getTodayRangeJST();

      // メッセージ一覧を取得
      const history = await client.conversations.history({
        channel: channelId,
        oldest: String(oldest),
        latest: String(latest),
        inclusive: true,
        limit: 200,
      });

      const messages = history.messages || [];
      this.logger.log(`${messages.length} 件のメッセージを取得しました`);

      // userId を解決（最初のユーザーを使用）
      const userId = await this.resolveUserId();
      if (!userId) {
        this.logger.error('Fact を紐付けるユーザーが見つかりません');
        return;
      }

      // 古い順に処理
      for (const msg of [...messages].reverse()) {
        if (!msg.ts) continue;

        const isThreadParent = msg.thread_ts && msg.thread_ts === msg.ts;
        const groupId = isThreadParent
          ? `slack:${teamId}:${channelId}:${msg.thread_ts}`
          : undefined;

        // 親メッセージを upsert
        const parentFact = await this.upsertFact(userId, {
          externalId: `${teamId}:${channelId}:${msg.ts}`,
          source: 'slack',
          occurredAt: new Date(parseFloat(msg.ts) * 1000),
          title: this.truncate(msg.text || '(no text)', 100),
          content: msg.text || null,
          type: 'slack.message',
          metadata: {
            channelId,
            teamId,
            slackUserId,
          },
          raw: msg,
          groupId,
          groupType: groupId ? 'slack_thread' : undefined,
          categoryId: defaultCategoryId,
          projectId: defaultProjectId,
        });

        // スレッド返信を取得
        if (isThreadParent) {
          const replies = await client.conversations.replies({
            channel: channelId,
            ts: msg.ts,
          });

          // 最初のメッセージ（親自身）を除外
          const replyMessages = (replies.messages || []).slice(1);

          for (const reply of replyMessages) {
            if (!reply.ts) continue;

            await this.upsertFact(userId, {
              externalId: `${teamId}:${channelId}:${reply.ts}`,
              source: 'slack',
              occurredAt: new Date(parseFloat(reply.ts) * 1000),
              title: this.truncate(reply.text || '(no text)', 100),
              content: reply.text || null,
              type: 'slack.thread_reply',
              metadata: {
                channelId,
                teamId,
                slackUserId,
                threadTs: msg.ts,
              },
              raw: reply,
              groupId: `slack:${teamId}:${channelId}:${msg.thread_ts}`,
              groupType: 'slack_thread',
              parentId: parentFact.id,
              categoryId: defaultCategoryId,
              projectId: defaultProjectId,
            });
          }
        }
      }

      this.logger.log('Slack DM メッセージ収集が完了しました');
    } catch (error) {
      this.logger.error('Slack DM メッセージ収集に失敗しました', error);
    }
  }

  /**
   * 当日 JST 0:00〜翌日 0:00 の UNIX タイムスタンプを返す
   */
  private getTodayRangeJST(): { oldest: number; latest: number } {
    const now = new Date();
    // JST = UTC + 9
    const jstOffset = 9 * 60 * 60 * 1000;
    const nowJST = new Date(now.getTime() + jstOffset);

    // JST での当日 0:00 を UTC で表現
    const startOfDayJST = new Date(
      Date.UTC(nowJST.getUTCFullYear(), nowJST.getUTCMonth(), nowJST.getUTCDate()) - jstOffset,
    );
    const endOfDayJST = new Date(startOfDayJST.getTime() + 24 * 60 * 60 * 1000);

    return {
      oldest: startOfDayJST.getTime() / 1000,
      latest: endOfDayJST.getTime() / 1000,
    };
  }

  /**
   * システムの最初のユーザー ID を返す
   */
  private async resolveUserId(): Promise<string | null> {
    const user = await this.prisma.user.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  /**
   * Fact を作成または更新
   */
  private async upsertFact(
    userId: string,
    data: {
      externalId: string;
      source: string;
      occurredAt: Date;
      title: string;
      content: string | null;
      type: string;
      metadata: Record<string, unknown>;
      raw: unknown;
      groupId?: string;
      groupType?: string;
      parentId?: string;
      categoryId?: string;
      projectId?: string;
    },
  ) {
    const fact = await this.prisma.fact.upsert({
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
        content: data.content,
        raw: data.raw as Prisma.InputJsonValue,
        type: data.type,
        metadata: data.metadata as Prisma.InputJsonValue,
        groupId: data.groupId,
        groupType: data.groupType,
        parentId: data.parentId,
        categoryId: data.categoryId,
        projectId: data.projectId,
      },
      update: {
        occurredAt: data.occurredAt,
        title: data.title,
        content: data.content,
        raw: data.raw as Prisma.InputJsonValue,
        type: data.type,
        metadata: data.metadata as Prisma.InputJsonValue,
        groupId: data.groupId,
        groupType: data.groupType,
        parentId: data.parentId,
        categoryId: data.categoryId,
        projectId: data.projectId,
      },
    });

    return fact;
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}
