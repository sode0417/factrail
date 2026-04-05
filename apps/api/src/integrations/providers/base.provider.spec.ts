import { DecryptedIntegration } from '../integrations.service';
import { BaseProvider } from './base.provider';
import { OAuthTokenResponse, ConnectionStatus } from './integration-provider.interface';

/**
 * テスト用の具象プロバイダー
 */
class TestProvider extends BaseProvider {
  readonly providerName = 'test';

  async exchangeOAuthCode(code: string): Promise<OAuthTokenResponse> {
    return {
      accessToken: `token-${code}`,
      accountId: 'test-account',
      accountName: 'Test Account',
    };
  }

  async validateConnection(_integration: DecryptedIntegration): Promise<ConnectionStatus> {
    return { connected: true };
  }
}

/**
 * refreshAccessToken をオーバーライドしたテスト用プロバイダー
 */
class RefreshableTestProvider extends BaseProvider {
  readonly providerName = 'refreshable-test';

  async exchangeOAuthCode(code: string): Promise<OAuthTokenResponse> {
    return {
      accessToken: `token-${code}`,
      accountId: 'test-account',
    };
  }

  async refreshAccessToken(_integration: DecryptedIntegration): Promise<OAuthTokenResponse> {
    return {
      accessToken: 'refreshed-token',
      accountId: 'test-account',
      expiresAt: new Date(Date.now() + 3600 * 1000),
    };
  }

  async validateConnection(_integration: DecryptedIntegration): Promise<ConnectionStatus> {
    return { connected: true };
  }
}

function createMockIntegration(
  overrides: Partial<DecryptedIntegration> = {},
): DecryptedIntegration {
  return {
    id: 'int-1',
    provider: 'test',
    accountId: 'acc-1',
    accountName: 'Test',
    accessToken: 'valid-token',
    refreshToken: null,
    expiresAt: null,
    scope: [],
    status: 'active',
    lastSyncAt: null,
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('BaseProvider', () => {
  let provider: TestProvider;

  beforeEach(() => {
    provider = new TestProvider();
  });

  describe('providerName', () => {
    it('具象クラスで定義した名前を返す', () => {
      expect(provider.providerName).toBe('test');
    });
  });

  describe('exchangeOAuthCode', () => {
    it('具象クラスの実装が呼ばれる', async () => {
      const result = await provider.exchangeOAuthCode('auth-code-123');
      expect(result).toEqual({
        accessToken: 'token-auth-code-123',
        accountId: 'test-account',
        accountName: 'Test Account',
      });
    });
  });

  describe('refreshAccessToken', () => {
    it('デフォルト実装はエラーをスローする', async () => {
      const integration = createMockIntegration();
      await expect(provider.refreshAccessToken(integration)).rejects.toThrow(
        'test はトークンリフレッシュに対応していません',
      );
    });

    it('オーバーライドすればリフレッシュできる', async () => {
      const refreshableProvider = new RefreshableTestProvider();
      const integration = createMockIntegration();
      const result = await refreshableProvider.refreshAccessToken(integration);
      expect(result.accessToken).toBe('refreshed-token');
    });
  });

  describe('validateConnection', () => {
    it('具象クラスの実装が呼ばれる', async () => {
      const integration = createMockIntegration();
      const result = await provider.validateConnection(integration);
      expect(result).toEqual({ connected: true });
    });
  });

  describe('isTokenExpired', () => {
    it('expiresAt が null なら期限切れではない', () => {
      const integration = createMockIntegration({ expiresAt: null });
      expect(provider.isTokenExpired(integration)).toBe(false);
    });

    it('未来の expiresAt（5分超）なら期限切れではない', () => {
      const future = new Date(Date.now() + 10 * 60 * 1000); // 10分後
      const integration = createMockIntegration({ expiresAt: future });
      expect(provider.isTokenExpired(integration)).toBe(false);
    });

    it('5分以内の expiresAt は期限切れとみなす', () => {
      const soon = new Date(Date.now() + 3 * 60 * 1000); // 3分後
      const integration = createMockIntegration({ expiresAt: soon });
      expect(provider.isTokenExpired(integration)).toBe(true);
    });

    it('過去の expiresAt は期限切れ', () => {
      const past = new Date(Date.now() - 60 * 1000); // 1分前
      const integration = createMockIntegration({ expiresAt: past });
      expect(provider.isTokenExpired(integration)).toBe(true);
    });
  });

  describe('ensureValidToken', () => {
    it('トークンが有効ならそのまま返す', async () => {
      const integration = createMockIntegration({ expiresAt: null });
      const result = await provider.ensureValidToken(integration);
      expect(result).toEqual({
        accessToken: 'valid-token',
        refreshed: false,
      });
    });

    it('トークンが期限切れでリフレッシュ非対応ならエラー', async () => {
      const expired = new Date(Date.now() - 60 * 1000);
      const integration = createMockIntegration({ expiresAt: expired });
      await expect(provider.ensureValidToken(integration)).rejects.toThrow(
        'test はトークンリフレッシュに対応していません',
      );
    });

    it('トークンが期限切れでリフレッシュ対応ならリフレッシュする', async () => {
      const refreshableProvider = new RefreshableTestProvider();
      const expired = new Date(Date.now() - 60 * 1000);
      const integration = createMockIntegration({ expiresAt: expired });

      const result = await refreshableProvider.ensureValidToken(integration);
      expect(result.accessToken).toBe('refreshed-token');
      expect(result.refreshed).toBe(true);
      expect(result.tokenResponse).toBeDefined();
    });
  });

  describe('fetchWithRetry', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
      // delay をモックして即時解決にする
      jest.spyOn(provider as any, 'delay').mockResolvedValue(undefined);
    });

    afterEach(() => {
      global.fetch = originalFetch;
      jest.restoreAllMocks();
    });

    it('成功時はレスポンスを返す', async () => {
      const mockResponse = new Response('ok', { status: 200 });
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const result = await (provider as any).fetchWithRetry('https://example.com', {});
      expect(result.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('失敗後にリトライして成功する', async () => {
      const mockResponse = new Response('ok', { status: 200 });
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce(mockResponse);

      const result = await (provider as any).fetchWithRetry('https://example.com', {});
      expect(result.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('全リトライ失敗時はエラーをスローする', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('persistent error'));

      await expect((provider as any).fetchWithRetry('https://example.com', {}, 1)).rejects.toThrow(
        'persistent error',
      );
      expect(global.fetch).toHaveBeenCalledTimes(2); // 初回 + 1リトライ
    });
  });

  describe('registerWebhook', () => {
    it('デフォルト実装はエラーをスローする', async () => {
      const integration = createMockIntegration();
      await expect(
        provider.registerWebhook(integration, { url: 'https://example.com', events: ['push'] }),
      ).rejects.toThrow('test は Webhook 登録に対応していません');
    });
  });

  describe('removeWebhook', () => {
    it('デフォルト実装はエラーをスローする', async () => {
      const integration = createMockIntegration();
      await expect(provider.removeWebhook(integration, 'wh-1')).rejects.toThrow(
        'test は Webhook 解除に対応していません',
      );
    });
  });

  describe('onDisconnect', () => {
    it('デフォルト実装はエラーなく完了する', async () => {
      const integration = createMockIntegration();
      await expect(provider.onDisconnect(integration)).resolves.toBeUndefined();
    });
  });
});
