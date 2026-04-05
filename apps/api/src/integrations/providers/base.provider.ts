import { Logger } from '@nestjs/common';
import { DecryptedIntegration } from '../integrations.service';
import {
  IntegrationProvider,
  OAuthTokenResponse,
  WebhookConfig,
  ConnectionStatus,
} from './integration-provider.interface';

/**
 * プロバイダーの共通ロジックを提供する抽象基底クラス
 *
 * 各プロバイダーはこのクラスを継承し、抽象メソッドを実装する。
 * トークンリフレッシュ判定、HTTP リクエストのリトライ、ロギングなど
 * 共通処理をここに集約する。
 */
export abstract class BaseProvider implements IntegrationProvider {
  protected readonly logger: Logger;

  abstract readonly providerName: string;

  constructor() {
    this.logger = new Logger(this.constructor.name);
  }

  abstract exchangeOAuthCode(code: string, redirectUri?: string): Promise<OAuthTokenResponse>;

  /**
   * デフォルト実装: トークンリフレッシュ非対応
   * リフレッシュ対応のプロバイダーはオーバーライドする
   */
  async refreshAccessToken(_integration: DecryptedIntegration): Promise<OAuthTokenResponse> {
    throw new Error(`${this.providerName} はトークンリフレッシュに対応していません`);
  }

  abstract validateConnection(integration: DecryptedIntegration): Promise<ConnectionStatus>;

  /**
   * トークンが期限切れ、または期限切れ間近（5分以内）かどうかを判定する
   */
  isTokenExpired(integration: DecryptedIntegration): boolean {
    if (!integration.expiresAt) {
      return false;
    }

    const expiresAt = new Date(integration.expiresAt);
    const now = new Date();
    const bufferMs = 5 * 60 * 1000;

    return expiresAt.getTime() <= now.getTime() + bufferMs;
  }

  /**
   * 必要に応じてトークンをリフレッシュし、有効なトークンを返す
   *
   * トークンが有効ならそのまま返し、期限切れなら refreshAccessToken を呼ぶ。
   * リフレッシュ非対応の場合はエラーをスローする。
   */
  async ensureValidToken(
    integration: DecryptedIntegration,
  ): Promise<{ accessToken: string; refreshed: boolean; tokenResponse?: OAuthTokenResponse }> {
    if (!this.isTokenExpired(integration)) {
      return { accessToken: integration.accessToken, refreshed: false };
    }

    this.logger.log(`${this.providerName}: トークンの期限切れを検出、リフレッシュを試行`);
    const tokenResponse = await this.refreshAccessToken(integration);
    return {
      accessToken: tokenResponse.accessToken,
      refreshed: true,
      tokenResponse,
    };
  }

  /**
   * HTTP リクエストをリトライ付きで実行する
   *
   * @param url リクエスト先 URL
   * @param options fetch のオプション
   * @param maxRetries 最大リトライ回数（デフォルト: 2）
   */
  protected async fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries = 2,
  ): Promise<Response> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries) {
          const delayMs = Math.pow(2, attempt) * 1000;
          this.logger.warn(
            `${this.providerName}: リクエスト失敗 (${attempt + 1}/${maxRetries + 1}), ${delayMs}ms 後にリトライ`,
          );
          await this.delay(delayMs);
        }
      }
    }

    throw lastError;
  }

  /**
   * 指定ミリ秒待機する（テスト時にモック可能）
   */
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Webhook 登録のデフォルト実装（非対応）
   * 対応プロバイダーはオーバーライドする
   */
  async registerWebhook(
    _integration: DecryptedIntegration,
    _config: WebhookConfig,
  ): Promise<string> {
    throw new Error(`${this.providerName} は Webhook 登録に対応していません`);
  }

  /**
   * Webhook 解除のデフォルト実装（非対応）
   */
  async removeWebhook(_integration: DecryptedIntegration, _webhookId: string): Promise<void> {
    throw new Error(`${this.providerName} は Webhook 解除に対応していません`);
  }

  /**
   * 連携解除時のクリーンアップ（デフォルト: 何もしない）
   */
  async onDisconnect(_integration: DecryptedIntegration): Promise<void> {
    this.logger.log(`${this.providerName}: 連携解除のクリーンアップ（デフォルト: なし）`);
  }
}
