import { DecryptedIntegration } from '../integrations.service';

/**
 * OAuth トークンレスポンスの型
 */
export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scope?: string[];
  accountId: string;
  accountName?: string;
}

/**
 * Webhook 設定の型
 */
export interface WebhookConfig {
  url: string;
  secret?: string;
  events: string[];
}

/**
 * 接続ステータスの型
 */
export interface ConnectionStatus {
  connected: boolean;
  message?: string;
}

/**
 * 各プロバイダーが実装する統一インターフェース
 *
 * 新しい外部サービスを追加する際は、このインターフェースを実装して
 * プロバイダー固有のロジックをカプセル化する。
 */
export interface IntegrationProvider {
  /**
   * プロバイダー識別子（例: 'github', 'slack', 'google'）
   */
  readonly providerName: string;

  /**
   * OAuth コールバックでトークンを交換する
   */
  exchangeOAuthCode(code: string, redirectUri?: string): Promise<OAuthTokenResponse>;

  /**
   * トークンをリフレッシュする（対応している場合）
   */
  refreshAccessToken(integration: DecryptedIntegration): Promise<OAuthTokenResponse>;

  /**
   * 接続状態を検証する（トークンが有効かどうか）
   */
  validateConnection(integration: DecryptedIntegration): Promise<ConnectionStatus>;

  /**
   * Webhook を登録する（対応している場合）
   */
  registerWebhook?(integration: DecryptedIntegration, config: WebhookConfig): Promise<string>;

  /**
   * Webhook を解除する（対応している場合）
   */
  removeWebhook?(integration: DecryptedIntegration, webhookId: string): Promise<void>;

  /**
   * 連携を解除する際のクリーンアップ処理
   */
  onDisconnect?(integration: DecryptedIntegration): Promise<void>;
}
