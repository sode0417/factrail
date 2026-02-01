import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { IntegrationsService, DecryptedIntegration } from './integrations.service';
import { PrismaService } from '../prisma.service';
import { CryptoService } from '../common/crypto';
import { CreateIntegrationDto, UpdateIntegrationDto } from './dto';

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let prisma: PrismaService;
  let crypto: CryptoService;

  const mockPrismaService = {
    integration: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockCryptoService = {
    encrypt: jest.fn((value: string) => `encrypted-${value}`),
    decrypt: jest.fn((value: string) => value.replace('encrypted-', '')),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CryptoService,
          useValue: mockCryptoService,
        },
      ],
    }).compile();

    service = module.get<IntegrationsService>(IntegrationsService);
    prisma = module.get<PrismaService>(PrismaService);
    crypto = module.get<CryptoService>(CryptoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const userId = 'user-123';
    const createDto: CreateIntegrationDto = {
      provider: 'github',
      accountId: 'gh-123',
      accountName: 'Test User',
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
      expiresAt: '2024-12-31T23:59:59Z',
      scope: ['read', 'write'],
    };

    const mockCreatedIntegration = {
      id: 'int-1',
      userId,
      provider: 'github',
      accountId: 'gh-123',
      accountName: 'Test User',
      accessToken: 'encrypted-access-token-123',
      refreshToken: 'encrypted-refresh-token-123',
      expiresAt: new Date('2024-12-31T23:59:59Z'),
      scope: ['read', 'write'],
      status: 'active',
      lastSyncAt: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    it('新しいIntegrationを作成できること', async () => {
      mockPrismaService.integration.create.mockResolvedValue(mockCreatedIntegration);

      const result = await service.create(userId, createDto);

      expect(result.accessToken).toBe('access-token-123');
      expect(result.refreshToken).toBe('refresh-token-123');
      expect(crypto.encrypt).toHaveBeenCalledWith('access-token-123');
      expect(crypto.encrypt).toHaveBeenCalledWith('refresh-token-123');
      expect(prisma.integration.create).toHaveBeenCalledWith({
        data: {
          userId,
          provider: 'github',
          accountId: 'gh-123',
          accountName: 'Test User',
          accessToken: 'encrypted-access-token-123',
          refreshToken: 'encrypted-refresh-token-123',
          expiresAt: new Date('2024-12-31T23:59:59Z'),
          scope: ['read', 'write'],
        },
      });
    });

    it('refreshTokenがnullの場合はnullのままであること', async () => {
      const dtoWithoutRefreshToken = {
        ...createDto,
        refreshToken: undefined,
      };
      const createdWithoutRefresh = {
        ...mockCreatedIntegration,
        refreshToken: null,
      };
      mockPrismaService.integration.create.mockResolvedValue(createdWithoutRefresh);

      const result = await service.create(userId, dtoWithoutRefreshToken);

      expect(result.refreshToken).toBeNull();
      expect(prisma.integration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            refreshToken: null,
          }),
        }),
      );
    });

    it('expiresAtが指定されていない場合はnullであること', async () => {
      const dtoWithoutExpiry = {
        ...createDto,
        expiresAt: undefined,
      };
      const createdWithoutExpiry = {
        ...mockCreatedIntegration,
        expiresAt: null,
      };
      mockPrismaService.integration.create.mockResolvedValue(createdWithoutExpiry);

      await service.create(userId, dtoWithoutExpiry);

      expect(prisma.integration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expiresAt: null,
          }),
        }),
      );
    });

    it('scopeが指定されていない場合は空配列であること', async () => {
      const dtoWithoutScope = {
        ...createDto,
        scope: undefined,
      };
      mockPrismaService.integration.create.mockResolvedValue(mockCreatedIntegration);

      await service.create(userId, dtoWithoutScope);

      expect(prisma.integration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scope: [],
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    const userId = 'user-123';
    const mockIntegrations = [
      {
        id: 'int-1',
        userId,
        provider: 'github',
        accountId: 'gh-123',
        accountName: 'User 1',
        accessToken: 'encrypted-token-1',
        refreshToken: 'encrypted-refresh-1',
        expiresAt: new Date('2024-12-31'),
        scope: ['read'],
        status: 'active',
        lastSyncAt: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'int-2',
        userId,
        provider: 'slack',
        accountId: 'slack-123',
        accountName: 'User 2',
        accessToken: 'encrypted-token-2',
        refreshToken: null,
        expiresAt: null,
        scope: ['write'],
        status: 'active',
        lastSyncAt: null,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
      },
    ];

    it('全てのIntegrationを取得できること', async () => {
      mockPrismaService.integration.findMany.mockResolvedValue(mockIntegrations);

      const result = await service.findAll(userId);

      expect(result).toHaveLength(2);
      expect(result[0].accessToken).toBe('token-1');
      expect(result[0].refreshToken).toBe('refresh-1');
      expect(result[1].accessToken).toBe('token-2');
      expect(result[1].refreshToken).toBeNull();
      expect(prisma.integration.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('Integrationがない場合は空配列を返すこと', async () => {
      mockPrismaService.integration.findMany.mockResolvedValue([]);

      const result = await service.findAll(userId);

      expect(result).toEqual([]);
    });
  });

  describe('findByProvider', () => {
    const userId = 'user-123';
    const provider = 'github';
    const mockIntegrations = [
      {
        id: 'int-1',
        userId,
        provider,
        accountId: 'gh-123',
        accountName: 'User 1',
        accessToken: 'encrypted-token-1',
        refreshToken: 'encrypted-refresh-1',
        expiresAt: new Date('2024-12-31'),
        scope: ['read'],
        status: 'active',
        lastSyncAt: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    ];

    it('プロバイダーでIntegrationを検索できること', async () => {
      mockPrismaService.integration.findMany.mockResolvedValue(mockIntegrations);

      const result = await service.findByProvider(userId, provider);

      expect(result).toHaveLength(1);
      expect(result[0].provider).toBe('github');
      expect(prisma.integration.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          provider,
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    const userId = 'user-123';
    const integrationId = 'int-1';
    const mockIntegration = {
      id: integrationId,
      userId,
      provider: 'github',
      accountId: 'gh-123',
      accountName: 'User 1',
      accessToken: 'encrypted-token-1',
      refreshToken: 'encrypted-refresh-1',
      expiresAt: new Date('2024-12-31'),
      scope: ['read'],
      status: 'active',
      lastSyncAt: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    it('IDでIntegrationを取得できること', async () => {
      mockPrismaService.integration.findFirst.mockResolvedValue(mockIntegration);

      const result = await service.findOne(userId, integrationId);

      expect(result.id).toBe(integrationId);
      expect(result.accessToken).toBe('token-1');
      expect(prisma.integration.findFirst).toHaveBeenCalledWith({
        where: {
          id: integrationId,
          userId,
        },
      });
    });

    it('Integrationが見つからない場合にNotFoundExceptionをスローすること', async () => {
      mockPrismaService.integration.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, integrationId)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(userId, integrationId)).rejects.toThrow(
        `連携が見つかりません: ID ${integrationId}`,
      );
    });
  });

  describe('findByProviderAndAccount', () => {
    const provider = 'github';
    const accountId = 'gh-123';
    const mockIntegration = {
      id: 'int-1',
      userId: 'user-123',
      provider,
      accountId,
      accountName: 'User 1',
      accessToken: 'encrypted-token-1',
      refreshToken: 'encrypted-refresh-1',
      expiresAt: new Date('2024-12-31'),
      scope: ['read'],
      status: 'active',
      lastSyncAt: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    it('プロバイダーとアカウントIDでIntegrationを検索できること', async () => {
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);

      const result = await service.findByProviderAndAccount(provider, accountId);

      expect(result).not.toBeNull();
      expect(result!.provider).toBe('github');
      expect(result!.accountId).toBe('gh-123');
      expect(prisma.integration.findUnique).toHaveBeenCalledWith({
        where: {
          provider_accountId: { provider, accountId },
        },
      });
    });

    it('Integrationが見つからない場合にnullを返すこと', async () => {
      mockPrismaService.integration.findUnique.mockResolvedValue(null);

      const result = await service.findByProviderAndAccount(provider, accountId);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    const userId = 'user-123';
    const integrationId = 'int-1';
    const existingIntegration = {
      id: integrationId,
      userId,
      provider: 'github',
      accountId: 'gh-123',
      accountName: 'Old Name',
      accessToken: 'encrypted-old-token',
      refreshToken: 'encrypted-old-refresh',
      expiresAt: new Date('2024-12-31'),
      scope: ['read'],
      status: 'active',
      lastSyncAt: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    it('Integrationを更新できること', async () => {
      const updateDto: UpdateIntegrationDto = {
        accountName: 'New Name',
        accessToken: 'new-token',
      };
      const updatedIntegration = {
        ...existingIntegration,
        accountName: 'New Name',
        accessToken: 'encrypted-new-token',
      };

      mockPrismaService.integration.findFirst.mockResolvedValue(existingIntegration);
      mockPrismaService.integration.update.mockResolvedValue(updatedIntegration);

      const result = await service.update(userId, integrationId, updateDto);

      expect(result.accountName).toBe('New Name');
      expect(result.accessToken).toBe('new-token');
      expect(crypto.encrypt).toHaveBeenCalledWith('new-token');
      expect(prisma.integration.update).toHaveBeenCalledWith({
        where: { id: integrationId },
        data: {
          accountName: 'New Name',
          accessToken: 'encrypted-new-token',
        },
      });
    });

    it('Integrationが見つからない場合にNotFoundExceptionをスローすること', async () => {
      mockPrismaService.integration.findFirst.mockResolvedValue(null);

      await expect(
        service.update(userId, integrationId, { accountName: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('refreshTokenをnullに更新できること', async () => {
      const updateDto: UpdateIntegrationDto = {
        refreshToken: null,
      };
      const updatedIntegration = {
        ...existingIntegration,
        refreshToken: null,
      };

      mockPrismaService.integration.findFirst.mockResolvedValue(existingIntegration);
      mockPrismaService.integration.update.mockResolvedValue(updatedIntegration);

      await service.update(userId, integrationId, updateDto);

      expect(prisma.integration.update).toHaveBeenCalledWith({
        where: { id: integrationId },
        data: {
          refreshToken: null,
        },
      });
    });

    it('複数フィールドを同時に更新できること', async () => {
      const updateDto: UpdateIntegrationDto = {
        accountName: 'New Name',
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresAt: '2025-12-31T23:59:59Z',
        scope: ['read', 'write', 'admin'],
        status: 'inactive',
      };
      const updatedIntegration = {
        ...existingIntegration,
        accountName: 'New Name',
        accessToken: 'encrypted-new-access',
        refreshToken: 'encrypted-new-refresh',
        expiresAt: new Date('2025-12-31T23:59:59Z'),
        scope: ['read', 'write', 'admin'],
        status: 'inactive',
      };

      mockPrismaService.integration.findFirst.mockResolvedValue(existingIntegration);
      mockPrismaService.integration.update.mockResolvedValue(updatedIntegration);

      await service.update(userId, integrationId, updateDto);

      expect(prisma.integration.update).toHaveBeenCalledWith({
        where: { id: integrationId },
        data: {
          accountName: 'New Name',
          accessToken: 'encrypted-new-access',
          refreshToken: 'encrypted-new-refresh',
          expiresAt: new Date('2025-12-31T23:59:59Z'),
          scope: ['read', 'write', 'admin'],
          status: 'inactive',
        },
      });
    });
  });

  describe('upsert', () => {
    const userId = 'user-123';
    const upsertDto: CreateIntegrationDto = {
      provider: 'github',
      accountId: 'gh-123',
      accountName: 'Test User',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2024-12-31T23:59:59Z',
      scope: ['read', 'write'],
    };

    const mockUpsertedIntegration = {
      id: 'int-1',
      userId,
      provider: 'github',
      accountId: 'gh-123',
      accountName: 'Test User',
      accessToken: 'encrypted-access-token',
      refreshToken: 'encrypted-refresh-token',
      expiresAt: new Date('2024-12-31T23:59:59Z'),
      scope: ['read', 'write'],
      status: 'active',
      lastSyncAt: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    it('Integrationをupsertできること', async () => {
      mockPrismaService.integration.upsert.mockResolvedValue(mockUpsertedIntegration);

      const result = await service.upsert(userId, upsertDto);

      expect(result.accessToken).toBe('access-token');
      expect(prisma.integration.upsert).toHaveBeenCalledWith({
        where: {
          provider_accountId: {
            provider: 'github',
            accountId: 'gh-123',
          },
        },
        create: {
          userId,
          provider: 'github',
          accountId: 'gh-123',
          accountName: 'Test User',
          accessToken: 'encrypted-access-token',
          refreshToken: 'encrypted-refresh-token',
          expiresAt: new Date('2024-12-31T23:59:59Z'),
          scope: ['read', 'write'],
        },
        update: {
          accountName: 'Test User',
          accessToken: 'encrypted-access-token',
          refreshToken: 'encrypted-refresh-token',
          expiresAt: new Date('2024-12-31T23:59:59Z'),
          scope: ['read', 'write'],
          status: 'active',
        },
      });
    });
  });

  describe('updateLastSync', () => {
    const integrationId = 'int-1';

    it('最終同期タイムスタンプを更新できること', async () => {
      mockPrismaService.integration.update.mockResolvedValue({});

      const beforeUpdate = new Date();
      await service.updateLastSync(integrationId);
      const afterUpdate = new Date();

      expect(prisma.integration.update).toHaveBeenCalledWith({
        where: { id: integrationId },
        data: { lastSyncAt: expect.any(Date) },
      });

      const call = mockPrismaService.integration.update.mock.calls[0][0];
      const lastSyncAt = call.data.lastSyncAt;

      expect(lastSyncAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
      expect(lastSyncAt.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
    });
  });

  describe('remove', () => {
    const userId = 'user-123';
    const integrationId = 'int-1';
    const existingIntegration = {
      id: integrationId,
      userId,
      provider: 'github',
      accountId: 'gh-123',
      accountName: 'User 1',
      accessToken: 'encrypted-token',
      refreshToken: null,
      expiresAt: null,
      scope: [],
      status: 'active',
      lastSyncAt: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    it('Integrationを削除できること', async () => {
      mockPrismaService.integration.findFirst.mockResolvedValue(existingIntegration);
      mockPrismaService.integration.delete.mockResolvedValue(existingIntegration);

      await service.remove(userId, integrationId);

      expect(prisma.integration.delete).toHaveBeenCalledWith({
        where: { id: integrationId },
      });
    });

    it('Integrationが見つからない場合にNotFoundExceptionをスローすること', async () => {
      mockPrismaService.integration.findFirst.mockResolvedValue(null);

      await expect(service.remove(userId, integrationId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate', () => {
    const userId = 'user-123';
    const integrationId = 'int-1';
    const existingIntegration = {
      id: integrationId,
      userId,
      provider: 'github',
      accountId: 'gh-123',
      accountName: 'User 1',
      accessToken: 'encrypted-token',
      refreshToken: null,
      expiresAt: null,
      scope: [],
      status: 'active',
      lastSyncAt: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    it('Integrationを無効化できること', async () => {
      const deactivatedIntegration = {
        ...existingIntegration,
        status: 'inactive',
      };

      mockPrismaService.integration.findFirst.mockResolvedValue(existingIntegration);
      mockPrismaService.integration.update.mockResolvedValue(deactivatedIntegration);

      const result = await service.deactivate(userId, integrationId);

      expect(result.status).toBe('inactive');
      expect(prisma.integration.update).toHaveBeenCalledWith({
        where: { id: integrationId },
        data: { status: 'inactive' },
      });
    });
  });

  describe('isTokenExpired', () => {
    const baseIntegration: DecryptedIntegration = {
      id: 'int-1',
      userId: 'user-123',
      provider: 'github',
      accountId: 'gh-123',
      accountName: 'User 1',
      accessToken: 'token',
      refreshToken: null,
      expiresAt: null,
      scope: [],
      status: 'active',
      lastSyncAt: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    it('expiresAtがnullの場合はfalseを返すこと', () => {
      const result = service.isTokenExpired(baseIntegration);
      expect(result).toBe(false);
    });

    it('有効期限が5分以上先の場合はfalseを返すこと', () => {
      const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);
      const integration = {
        ...baseIntegration,
        expiresAt: tenMinutesFromNow,
      };

      const result = service.isTokenExpired(integration);
      expect(result).toBe(false);
    });

    it('有効期限が5分以内の場合はtrueを返すこと', () => {
      const threeMinutesFromNow = new Date(Date.now() + 3 * 60 * 1000);
      const integration = {
        ...baseIntegration,
        expiresAt: threeMinutesFromNow,
      };

      const result = service.isTokenExpired(integration);
      expect(result).toBe(true);
    });

    it('有効期限が過去の場合はtrueを返すこと', () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const integration = {
        ...baseIntegration,
        expiresAt: tenMinutesAgo,
      };

      const result = service.isTokenExpired(integration);
      expect(result).toBe(true);
    });

    it('有効期限がちょうど5分後の場合はtrueを返すこと', () => {
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
      const integration = {
        ...baseIntegration,
        expiresAt: fiveMinutesFromNow,
      };

      const result = service.isTokenExpired(integration);
      expect(result).toBe(true);
    });
  });
});
