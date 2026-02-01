import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService, DecryptedIntegration } from './integrations.service';
import { SlackOAuthService } from './slack-oauth.service';
import { CreateIntegrationDto, UpdateIntegrationDto, SlackOAuthCallbackDto } from './dto';

describe('IntegrationsController', () => {
  let controller: IntegrationsController;
  let integrationsService: IntegrationsService;
  let slackOAuthService: SlackOAuthService;

  const mockIntegrationsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByProvider: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    deactivate: jest.fn(),
  };

  const mockSlackOAuthService = {
    handleCallback: jest.fn(),
  };

  const mockRequest = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  };

  const mockIntegration: DecryptedIntegration = {
    id: 'int-1',
    userId: 'user-123',
    provider: 'github',
    accountId: 'gh-123',
    accountName: 'Test User',
    accessToken: 'decrypted-token',
    refreshToken: 'decrypted-refresh',
    expiresAt: new Date('2024-12-31'),
    scope: ['read', 'write'],
    status: 'active',
    lastSyncAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IntegrationsController],
      providers: [
        {
          provide: IntegrationsService,
          useValue: mockIntegrationsService,
        },
        {
          provide: SlackOAuthService,
          useValue: mockSlackOAuthService,
        },
      ],
    }).compile();

    controller = module.get<IntegrationsController>(IntegrationsController);
    integrationsService = module.get<IntegrationsService>(IntegrationsService);
    slackOAuthService = module.get<SlackOAuthService>(SlackOAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateIntegrationDto = {
      provider: 'github',
      accountId: 'gh-123',
      accountName: 'Test User',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2024-12-31T23:59:59Z',
      scope: ['read', 'write'],
    };

    it('新しいIntegrationを作成できること', async () => {
      mockIntegrationsService.create.mockResolvedValue(mockIntegration);

      const result = await controller.create(mockRequest, createDto);

      expect(result).toEqual({
        id: 'int-1',
        provider: 'github',
        accountId: 'gh-123',
        accountName: 'Test User',
        expiresAt: new Date('2024-12-31'),
        scope: ['read', 'write'],
        status: 'active',
        lastSyncAt: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        hasAccessToken: true,
        hasRefreshToken: true,
      });
      expect(integrationsService.create).toHaveBeenCalledWith('user-123', createDto);
    });

    it('機密トークンが含まれないこと', async () => {
      mockIntegrationsService.create.mockResolvedValue(mockIntegration);

      const result = await controller.create(mockRequest, createDto);

      expect(result).not.toHaveProperty('accessToken');
      expect(result).not.toHaveProperty('refreshToken');
      expect(result.hasAccessToken).toBe(true);
      expect(result.hasRefreshToken).toBe(true);
    });
  });

  describe('findAll', () => {
    it('全てのIntegrationを取得できること', async () => {
      const mockIntegrations = [mockIntegration];
      mockIntegrationsService.findAll.mockResolvedValue(mockIntegrations);

      const result = await controller.findAll(mockRequest);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        id: 'int-1',
        provider: 'github',
        accountId: 'gh-123',
        accountName: 'Test User',
        expiresAt: new Date('2024-12-31'),
        scope: ['read', 'write'],
        status: 'active',
        lastSyncAt: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        hasAccessToken: true,
        hasRefreshToken: true,
      });
      expect(integrationsService.findAll).toHaveBeenCalledWith('user-123');
    });

    it('プロバイダーでフィルタリングできること', async () => {
      const mockIntegrations = [mockIntegration];
      mockIntegrationsService.findByProvider.mockResolvedValue(mockIntegrations);

      const result = await controller.findAll(mockRequest, 'github');

      expect(result.data).toHaveLength(1);
      expect(integrationsService.findByProvider).toHaveBeenCalledWith('user-123', 'github');
      expect(integrationsService.findAll).not.toHaveBeenCalled();
    });

    it('空の配列を返すこと', async () => {
      mockIntegrationsService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(mockRequest);

      expect(result.data).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('IDでIntegrationを取得できること', async () => {
      mockIntegrationsService.findOne.mockResolvedValue(mockIntegration);

      const result = await controller.findOne(mockRequest, 'int-1');

      expect(result).toEqual({
        id: 'int-1',
        provider: 'github',
        accountId: 'gh-123',
        accountName: 'Test User',
        expiresAt: new Date('2024-12-31'),
        scope: ['read', 'write'],
        status: 'active',
        lastSyncAt: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        hasAccessToken: true,
        hasRefreshToken: true,
      });
      expect(integrationsService.findOne).toHaveBeenCalledWith('user-123', 'int-1');
    });
  });

  describe('update', () => {
    const updateDto: UpdateIntegrationDto = {
      accountName: 'Updated Name',
      accessToken: 'new-token',
    };

    const updatedIntegration: DecryptedIntegration = {
      ...mockIntegration,
      accountName: 'Updated Name',
      accessToken: 'new-token',
    };

    it('Integrationを更新できること', async () => {
      mockIntegrationsService.update.mockResolvedValue(updatedIntegration);

      const result = await controller.update(mockRequest, 'int-1', updateDto);

      expect(result.accountName).toBe('Updated Name');
      expect(result.hasAccessToken).toBe(true);
      expect(integrationsService.update).toHaveBeenCalledWith('user-123', 'int-1', updateDto);
    });
  });

  describe('remove', () => {
    it('Integrationを削除できること', async () => {
      mockIntegrationsService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(mockRequest, 'int-1');

      expect(result).toEqual({ success: true });
      expect(integrationsService.remove).toHaveBeenCalledWith('user-123', 'int-1');
    });
  });

  describe('deactivate', () => {
    const deactivatedIntegration: DecryptedIntegration = {
      ...mockIntegration,
      status: 'inactive',
    };

    it('Integrationを無効化できること', async () => {
      mockIntegrationsService.deactivate.mockResolvedValue(deactivatedIntegration);

      const result = await controller.deactivate(mockRequest, 'int-1');

      expect(result.status).toBe('inactive');
      expect(integrationsService.deactivate).toHaveBeenCalledWith('user-123', 'int-1');
    });
  });

  describe('slackCallback', () => {
    const callbackDto: SlackOAuthCallbackDto = {
      code: 'auth-code-123',
    };

    it('Slack OAuth callbackを処理できること', async () => {
      mockSlackOAuthService.handleCallback.mockResolvedValue(undefined);

      const result = await controller.slackCallback(callbackDto);

      expect(result).toEqual({ success: true });
      expect(slackOAuthService.handleCallback).toHaveBeenCalledWith('auth-code-123');
    });
  });

  describe('toResponse', () => {
    it('refreshTokenがnullの場合hasRefreshTokenがfalseであること', async () => {
      const integrationWithoutRefresh: DecryptedIntegration = {
        ...mockIntegration,
        refreshToken: null,
      };
      mockIntegrationsService.findOne.mockResolvedValue(integrationWithoutRefresh);

      const result = await controller.findOne(mockRequest, 'int-1');

      expect(result.hasRefreshToken).toBe(false);
    });

    it('accessTokenが空文字列の場合hasAccessTokenがfalseであること', async () => {
      const integrationWithoutAccess: DecryptedIntegration = {
        ...mockIntegration,
        accessToken: '',
      };
      mockIntegrationsService.findOne.mockResolvedValue(integrationWithoutAccess);

      const result = await controller.findOne(mockRequest, 'int-1');

      expect(result.hasAccessToken).toBe(false);
    });
  });
});
