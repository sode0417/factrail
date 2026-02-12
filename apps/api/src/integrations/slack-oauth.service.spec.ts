import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, Logger } from '@nestjs/common';
import { SlackOAuthService } from './slack-oauth.service';
import { SettingsService } from '../settings/settings.service';
import { IntegrationsService } from './integrations.service';
import { SlackOAuthStateService } from './slack-oauth-state.service';

// Mock fetch globally
global.fetch = jest.fn();

describe('SlackOAuthService', () => {
  let service: SlackOAuthService;

  const mockSettingsService = {
    getDecryptedValue: jest.fn(),
    upsert: jest.fn(),
  };

  const mockIntegrationsService = {
    upsert: jest.fn(),
  };

  const mockSlackOAuthStateService = {
    validateState: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlackOAuthService,
        {
          provide: SettingsService,
          useValue: mockSettingsService,
        },
        {
          provide: IntegrationsService,
          useValue: mockIntegrationsService,
        },
        {
          provide: SlackOAuthStateService,
          useValue: mockSlackOAuthStateService,
        },
      ],
    }).compile();

    service = module.get<SlackOAuthService>(SlackOAuthService);

    // Disable logging during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleCallback', () => {
    const code = 'test-auth-code';
    const state = 'test-state';
    const clientId = 'test-client-id';
    const clientSecret = 'test-client-secret';

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      status: 'active',
      createdAt: new Date(),
    };

    const mockOAuthResponse = {
      ok: true,
      access_token: 'xoxb-slack-token',
      token_type: 'bot',
      scope: 'chat:write,users:read',
      bot_user_id: 'B123456',
      app_id: 'A123456',
      team: {
        name: 'Test Team',
        id: 'T123456',
      },
      authed_user: {
        id: 'U123456',
        scope: 'chat:write',
        access_token: 'xoxp-user-token',
        token_type: 'user',
      },
    };

    beforeEach(() => {
      mockSettingsService.getDecryptedValue
        .mockResolvedValueOnce(clientId)
        .mockResolvedValueOnce(clientSecret);
      mockSlackOAuthStateService.validateState.mockReturnValue(mockUser.id);
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue(mockOAuthResponse),
      });
      mockIntegrationsService.upsert.mockResolvedValue({});
      mockSettingsService.upsert.mockResolvedValue({});
    });

    it('OAuth callbackを正常に処理できること', async () => {
      await service.handleCallback(code, state);

      expect(mockSettingsService.getDecryptedValue).toHaveBeenCalledWith('slack', 'client_id');
      expect(mockSettingsService.getDecryptedValue).toHaveBeenCalledWith('slack', 'client_secret');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://slack.com/api/oauth.v2.access',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );
      expect(mockIntegrationsService.upsert).toHaveBeenCalledWith('user-123', {
        provider: 'slack',
        accountId: 'T123456',
        accountName: 'Test Team',
        accessToken: 'xoxb-slack-token',
        refreshToken: null,
        expiresAt: null,
        scope: ['chat:write', 'users:read'],
      });
      expect(mockSettingsService.upsert).toHaveBeenCalledWith(
        {
          provider: 'slack',
          settingType: 'target_channel_id',
          value: 'U123456',
        },
        'user-123',
      );
    });

    it('Client IDが設定されていない場合はエラーをスローすること', async () => {
      mockSettingsService.getDecryptedValue.mockReset();
      mockSettingsService.getDecryptedValue
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(clientSecret);

      await expect(service.handleCallback(code, state)).rejects.toThrow(
        'Slack Client IDまたはClient Secretが設定されていません',
      );
    });

    it('Client Secretが設定されていない場合はエラーをスローすること', async () => {
      mockSettingsService.getDecryptedValue.mockReset();
      mockSettingsService.getDecryptedValue
        .mockResolvedValueOnce(clientId)
        .mockResolvedValueOnce(null);

      await expect(service.handleCallback(code, state)).rejects.toThrow(BadRequestException);
    });

    it('Slack APIがエラーを返す場合はエラーをスローすること', async () => {
      mockSettingsService.getDecryptedValue.mockReset();
      mockSettingsService.getDecryptedValue
        .mockResolvedValueOnce(clientId)
        .mockResolvedValueOnce(clientSecret);

      const errorResponse = {
        ok: false,
        error: 'invalid_code',
      };
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue(errorResponse),
      });

      await expect(service.handleCallback(code, state)).rejects.toThrow(
        'Slack OAuth エラー: invalid_code',
      );
    });

    it('access_tokenがない場合はエラーをスローすること', async () => {
      const responseWithoutToken = {
        ok: true,
        // access_token がない
      };
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue(responseWithoutToken),
      });

      await expect(service.handleCallback(code, state)).rejects.toThrow(BadRequestException);
    });

    it('stateが無効な場合はエラーをスローすること', async () => {
      mockSettingsService.getDecryptedValue.mockReset();
      mockSettingsService.getDecryptedValue
        .mockResolvedValueOnce(clientId)
        .mockResolvedValueOnce(clientSecret);
      mockSlackOAuthStateService.validateState.mockImplementation(() => {
        throw new BadRequestException('Invalid OAuth state parameter');
      });

      await expect(service.handleCallback(code, state)).rejects.toThrow(BadRequestException);
    });

    it('teamがない場合はデフォルト値を使用すること', async () => {
      const responseWithoutTeam = {
        ...mockOAuthResponse,
        team: undefined,
      };
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue(responseWithoutTeam),
      });

      await service.handleCallback(code, state);

      expect(mockIntegrationsService.upsert).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          accountId: 'unknown',
          accountName: 'Unknown Team',
        }),
      );
    });

    it('scopeがない場合は空配列を使用すること', async () => {
      const responseWithoutScope = {
        ...mockOAuthResponse,
        scope: undefined,
      };
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue(responseWithoutScope),
      });

      await service.handleCallback(code, state);

      expect(mockIntegrationsService.upsert).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          scope: [],
        }),
      );
    });

    it('authed_userがない場合は送信先IDを設定しないこと', async () => {
      const responseWithoutAuthedUser = {
        ...mockOAuthResponse,
        authed_user: undefined,
      };
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue(responseWithoutAuthedUser),
      });

      await service.handleCallback(code, state);

      expect(mockSettingsService.upsert).not.toHaveBeenCalledWith(
        expect.objectContaining({
          settingType: 'target_channel_id',
        }),
      );
    });

    it('scopeをカンマ区切りで配列に変換すること', async () => {
      const responseWithScope = {
        ...mockOAuthResponse,
        scope: 'chat:write,users:read,channels:read',
      };
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue(responseWithScope),
      });

      await service.handleCallback(code, state);

      expect(mockIntegrationsService.upsert).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          scope: ['chat:write', 'users:read', 'channels:read'],
        }),
      );
    });
  });
});
