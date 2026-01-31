import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { IntegrationsService } from './integrations.service';
import { PrismaService } from '../prisma.service';

interface SlackOAuthResponse {
  ok: boolean;
  access_token?: string;
  token_type?: string;
  scope?: string;
  bot_user_id?: string;
  app_id?: string;
  team?: {
    name: string;
    id: string;
  };
  enterprise?: {
    name: string;
    id: string;
  };
  authed_user?: {
    id: string;
    scope?: string;
    access_token?: string;
    token_type?: string;
  };
  error?: string;
}

@Injectable()
export class SlackOAuthService {
  private readonly logger = new Logger(SlackOAuthService.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly integrationsService: IntegrationsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * OAuth codeをアクセストークンと交換し、Integrationsに保存
   */
  async handleCallback(code: string): Promise<void> {
    this.logger.log('Slack OAuth callbackを処理開始');

    // Settingsから client_id と client_secret を取得
    const clientId = await this.settingsService.getDecryptedValue('slack', 'client_id');
    const clientSecret = await this.settingsService.getDecryptedValue('slack', 'client_secret');

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Slack Client IDまたはClient Secretが設定されていません');
    }

    this.logger.log('Slack APIにトークンをリクエスト中');

    // Slack API でトークン交換
    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }).toString(),
    });

    const data: SlackOAuthResponse = await response.json();

    if (!data.ok || !data.access_token) {
      this.logger.error(`Slack OAuth エラー: ${data.error}`);
      throw new BadRequestException(`Slack OAuth エラー: ${data.error || '不明なエラー'}`);
    }

    this.logger.log(`Slack OAuth成功: チーム=${data.team?.name}, ユーザー=${data.authed_user?.id}`);

    // ユーザーIDを取得（最初のアクティブユーザーを使用）
    // TODO: OAuth開始時にstateパラメータでuserIdを渡す実装に変更する
    const userId = await this.findUserIdForSlackIntegration();
    if (!userId) {
      throw new BadRequestException(
        'ユーザーが見つかりません。先にユーザー登録を完了してください。',
      );
    }

    // Integrations テーブルに保存
    const teamId = data.team?.id || 'unknown';
    const teamName = data.team?.name || 'Unknown Team';
    const scopes = data.scope?.split(',') || [];

    await this.integrationsService.upsert(userId, {
      provider: 'slack',
      accountId: teamId,
      accountName: teamName,
      accessToken: data.access_token,
      refreshToken: null, // Slack OAuth 2.0はrefresh tokenを使用しない
      expiresAt: null, // Slack トークンは期限切れなし
      scope: scopes,
    });

    this.logger.log('Slack連携情報をIntegrationsに保存しました');

    // 認証したユーザーのIDを送信先として自動設定
    if (data.authed_user?.id) {
      await this.settingsService.upsert({
        provider: 'slack',
        settingType: 'target_channel_id',
        value: data.authed_user.id,
      });
      this.logger.log(`Slack送信先ID（User）を保存しました: ${data.authed_user.id}`);
    }
  }

  /**
   * Slack連携に使用するユーザーIDを取得する
   * 現在はシステム内の最初のアクティブユーザーを返す
   *
   * @remarks
   * TODO: 将来的にはOAuth開始時にstateパラメータでuserIdを渡す実装に変更する
   */
  private async findUserIdForSlackIntegration(): Promise<string | null> {
    const user = await this.prisma.user.findFirst({
      where: { status: 'active' },
      orderBy: { createdAt: 'asc' },
    });

    if (!user) {
      this.logger.warn('アクティブなユーザーが見つかりません');
      return null;
    }

    return user.id;
  }
}
