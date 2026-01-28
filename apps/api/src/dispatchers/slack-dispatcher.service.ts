import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { WebClient } from '@slack/web-api';
import { IntegrationsService } from '../integrations/integrations.service';
import { SettingsService } from '../settings/settings.service';
import { Fact } from '@prisma/client';

@Injectable()
export class SlackDispatcherService {
  private readonly logger = new Logger(SlackDispatcherService.name);

  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Slack（DM/チャンネル）にFactを投稿する
   * @param fact 投稿するFact
   * @returns Slack message timestamp (ts)
   */
  async postFactToDM(fact: Fact): Promise<string> {
    // Slack Integration からアクセストークンを取得
    const integrations = await this.integrationsService.findByProvider('slack');

    if (!integrations || integrations.length === 0) {
      throw new InternalServerErrorException('Slack連携が設定されていません');
    }

    const integration = integrations[0];
    const client = new WebClient(integration.accessToken);

    // 送信先ID（User ID or Channel ID）を取得
    const channelId = await this.settingsService.getDecryptedValue('slack', 'target_channel_id');
    if (!channelId) {
      throw new InternalServerErrorException('Slack送信先ID（User/Channel）が設定されていません');
    }

    // Block Kit メッセージを作成
    const blocks = this.buildMessageBlocks(fact);

    this.logger.log(`Slack投稿中: Fact ID=${fact.id}, Channel=${channelId}`);

    try {
      const result = await client.chat.postMessage({
        channel: channelId,
        blocks,
        text: fact.title, // フォールバック用テキスト
      });

      this.logger.log(`Slack投稿成功: ts=${result.ts}`);
      return result.ts as string;
    } catch (error) {
      this.logger.error(`Slack投稿失敗: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Fact から Slack Block Kit メッセージを生成
   */
  private buildMessageBlocks(fact: Fact) {
    const emoji = this.getEmojiForSource(fact.source);

    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} 新しいFact`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*タイトル:*\n${fact.title}`,
          },
          {
            type: 'mrkdwn',
            text: `*ソース:*\n${fact.source}`,
          },
        ],
      },
      ...(fact.summary
        ? [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: fact.summary,
              },
            },
          ]
        : []),
      ...(fact.sourceUrl
        ? [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `<${fact.sourceUrl}|詳細を見る>`,
              },
            },
          ]
        : []),
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `発生: ${fact.occurredAt.toLocaleString('ja-JP')} | タイプ: ${fact.type}`,
          },
        ],
      },
    ];
  }

  /**
   * ソースに応じた絵文字を返す
   */
  private getEmojiForSource(source: string): string {
    const emojiMap: Record<string, string> = {
      github: '🐙',
      slack: '💬',
      google: '📅',
      manual: '✍️',
    };
    return emojiMap[source] || '📌';
  }
}
