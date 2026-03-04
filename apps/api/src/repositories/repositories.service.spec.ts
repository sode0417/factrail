import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RepositoriesService } from './repositories.service';
import { PrismaService } from '../prisma.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { SettingsService } from '../settings/settings.service';
import { GitHubApiService } from './github-api.service';

describe('RepositoriesService', () => {
  let service: RepositoriesService;

  const mockPrismaService = {
    repository: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    fact: {
      findMany: jest.fn(),
    },
  };

  const mockIntegrationsService = {
    findByProvider: jest.fn(),
  };

  const mockGitHubApiService = {
    listRepositories: jest.fn(),
    getRepository: jest.fn(),
    createWebhook: jest.fn(),
    deleteWebhook: jest.fn(),
  };

  const mockSettingsService = {
    getDecryptedValue: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const userId = 'user-123';
  const mockIntegration = {
    id: 'int-1',
    userId,
    provider: 'github',
    accountId: 'testuser',
    accountName: 'testuser',
    accessToken: 'test-token',
    refreshToken: null,
    expiresAt: null,
    scope: ['repo'],
    status: 'active',
    lastSyncAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepositoriesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: IntegrationsService,
          useValue: mockIntegrationsService,
        },
        {
          provide: GitHubApiService,
          useValue: mockGitHubApiService,
        },
        {
          provide: SettingsService,
          useValue: mockSettingsService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RepositoriesService>(RepositoriesService);

    // デフォルトでIntegrationが見つかるようにする
    mockIntegrationsService.findByProvider.mockResolvedValue([mockIntegration]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('登録済みリポジトリ一覧を取得できること', async () => {
      const mockRepos = [
        {
          id: 'repo-1',
          integrationId: 'int-1',
          fullName: 'testuser/repo1',
          owner: 'testuser',
          name: 'repo1',
          isPrivate: false,
          status: 'active',
          lastEventAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockPrismaService.repository.findMany.mockResolvedValue(mockRepos);

      const result = await service.findAll(userId);

      expect(result).toEqual(mockRepos);
      expect(mockPrismaService.repository.findMany).toHaveBeenCalledWith({
        where: { integrationId: 'int-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('GitHub連携がない場合はNotFoundExceptionをスローすること', async () => {
      mockIntegrationsService.findByProvider.mockResolvedValue([]);

      await expect(service.findAll(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAvailableRepositories', () => {
    it('GitHub APIからリポジトリ候補を取得できること', async () => {
      const mockGitHubRepos = [
        {
          fullName: 'testuser/repo1',
          name: 'repo1',
          owner: 'testuser',
          isPrivate: false,
          htmlUrl: 'https://github.com/testuser/repo1',
        },
        {
          fullName: 'testuser/repo2',
          name: 'repo2',
          owner: 'testuser',
          isPrivate: true,
          htmlUrl: 'https://github.com/testuser/repo2',
        },
      ];
      mockGitHubApiService.listRepositories.mockResolvedValue(mockGitHubRepos);

      const result = await service.getAvailableRepositories(userId);

      expect(result).toEqual(mockGitHubRepos);
      expect(mockGitHubApiService.listRepositories).toHaveBeenCalledWith('test-token');
    });
  });

  describe('add', () => {
    const repoInfo = {
      fullName: 'testuser/repo1',
      name: 'repo1',
      owner: 'testuser',
      isPrivate: false,
      htmlUrl: 'https://github.com/testuser/repo1',
    };

    it('リポジトリを追加しWebhookを自動作成すること', async () => {
      mockGitHubApiService.getRepository.mockResolvedValue(repoInfo);
      mockPrismaService.repository.findUnique.mockResolvedValue(null);
      mockConfigService.get.mockReturnValue('https://api.example.com');
      mockSettingsService.getDecryptedValue.mockResolvedValue('webhook-secret-123');
      mockGitHubApiService.createWebhook.mockResolvedValue(42);

      const createdRepo = {
        id: 'repo-1',
        integrationId: 'int-1',
        fullName: 'testuser/repo1',
        owner: 'testuser',
        name: 'repo1',
        isPrivate: false,
        webhookId: 42,
        status: 'active',
        lastEventAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaService.repository.create.mockResolvedValue(createdRepo);

      const result = await service.add(userId, 'testuser/repo1');

      expect(result).toEqual(createdRepo);
      expect(mockGitHubApiService.createWebhook).toHaveBeenCalledWith(
        'test-token',
        'testuser/repo1',
        {
          url: 'https://api.example.com/webhooks/github',
          secret: 'webhook-secret-123',
          events: ['issues', 'pull_request', 'push'],
        },
      );
      expect(mockPrismaService.repository.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ webhookId: 42 }),
      });
    });

    it('Webhook作成に失敗してもリポジトリ追加は成功すること', async () => {
      mockGitHubApiService.getRepository.mockResolvedValue(repoInfo);
      mockPrismaService.repository.findUnique.mockResolvedValue(null);
      mockConfigService.get.mockReturnValue('https://api.example.com');
      mockSettingsService.getDecryptedValue.mockResolvedValue('webhook-secret-123');
      mockGitHubApiService.createWebhook.mockRejectedValue(new Error('403 Forbidden'));
      mockPrismaService.repository.create.mockResolvedValue({ id: 'repo-1' });

      const result = await service.add(userId, 'testuser/repo1');

      expect(result).toEqual({ id: 'repo-1' });
      expect(mockPrismaService.repository.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ webhookId: null }),
      });
    });

    it('API_URLが未設定の場合はWebhook作成をスキップすること', async () => {
      mockGitHubApiService.getRepository.mockResolvedValue(repoInfo);
      mockPrismaService.repository.findUnique.mockResolvedValue(null);
      mockConfigService.get.mockReturnValue(undefined);
      mockSettingsService.getDecryptedValue.mockResolvedValue('webhook-secret-123');
      mockPrismaService.repository.create.mockResolvedValue({ id: 'repo-1' });

      await service.add(userId, 'testuser/repo1');

      expect(mockGitHubApiService.createWebhook).not.toHaveBeenCalled();
      expect(mockPrismaService.repository.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ webhookId: null }),
      });
    });

    it('GitHubにリポジトリが存在しない場合はNotFoundExceptionをスローすること', async () => {
      mockGitHubApiService.getRepository.mockResolvedValue(null);

      await expect(service.add(userId, 'testuser/nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('既に登録済みの場合はBadRequestExceptionをスローすること', async () => {
      mockGitHubApiService.getRepository.mockResolvedValue(repoInfo);
      mockPrismaService.repository.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.add(userId, 'testuser/repo1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('リポジトリを削除しWebhookも自動削除すること', async () => {
      const mockRepo = {
        id: 'repo-1',
        integrationId: 'int-1',
        fullName: 'testuser/repo1',
        webhookId: 42,
      };
      mockPrismaService.repository.findFirst.mockResolvedValue(mockRepo);
      mockPrismaService.repository.delete.mockResolvedValue(mockRepo);

      await service.remove(userId, 'repo-1');

      expect(mockGitHubApiService.deleteWebhook).toHaveBeenCalledWith(
        'test-token',
        'testuser/repo1',
        42,
      );
      expect(mockPrismaService.repository.delete).toHaveBeenCalledWith({
        where: { id: 'repo-1' },
      });
    });

    it('webhookIdがない場合はWebhook削除をスキップすること', async () => {
      const mockRepo = {
        id: 'repo-1',
        integrationId: 'int-1',
        fullName: 'testuser/repo1',
        webhookId: null,
      };
      mockPrismaService.repository.findFirst.mockResolvedValue(mockRepo);
      mockPrismaService.repository.delete.mockResolvedValue(mockRepo);

      await service.remove(userId, 'repo-1');

      expect(mockGitHubApiService.deleteWebhook).not.toHaveBeenCalled();
      expect(mockPrismaService.repository.delete).toHaveBeenCalledWith({
        where: { id: 'repo-1' },
      });
    });

    it('Webhook削除に失敗してもリポジトリ削除は成功すること', async () => {
      const mockRepo = {
        id: 'repo-1',
        integrationId: 'int-1',
        fullName: 'testuser/repo1',
        webhookId: 42,
      };
      mockPrismaService.repository.findFirst.mockResolvedValue(mockRepo);
      mockGitHubApiService.deleteWebhook.mockRejectedValue(new Error('Network error'));
      mockPrismaService.repository.delete.mockResolvedValue(mockRepo);

      await service.remove(userId, 'repo-1');

      expect(mockPrismaService.repository.delete).toHaveBeenCalledWith({
        where: { id: 'repo-1' },
      });
    });

    it('リポジトリが見つからない場合はNotFoundExceptionをスローすること', async () => {
      mockPrismaService.repository.findFirst.mockResolvedValue(null);

      await expect(service.remove(userId, 'repo-nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('detectFromFacts', () => {
    it('既存Factsからリポジトリを自動検出して登録できること', async () => {
      const mockFacts = [
        { metadata: { repository: 'testuser/repo1' } },
        { metadata: { repository: 'testuser/repo2' } },
        { metadata: { repository: 'testuser/repo1' } }, // 重複
      ];
      mockPrismaService.fact.findMany.mockResolvedValue(mockFacts);
      mockPrismaService.repository.findUnique.mockResolvedValue(null);
      mockGitHubApiService.getRepository.mockResolvedValue({
        fullName: 'testuser/repo1',
        name: 'repo1',
        owner: 'testuser',
        isPrivate: false,
      });
      mockPrismaService.repository.create.mockResolvedValue({});

      const result = await service.detectFromFacts(userId);

      expect(result.added).toHaveLength(2);
      expect(result.added).toContain('testuser/repo1');
      expect(result.added).toContain('testuser/repo2');
    });

    it('既に登録済みのリポジトリはスキップすること', async () => {
      const mockFacts = [{ metadata: { repository: 'testuser/repo1' } }];
      mockPrismaService.fact.findMany.mockResolvedValue(mockFacts);
      mockPrismaService.repository.findUnique.mockResolvedValue({ id: 'existing' });

      const result = await service.detectFromFacts(userId);

      expect(result.added).toHaveLength(0);
      expect(mockPrismaService.repository.create).not.toHaveBeenCalled();
    });

    it('Factsがない場合は空の結果を返すこと', async () => {
      mockPrismaService.fact.findMany.mockResolvedValue([]);

      const result = await service.detectFromFacts(userId);

      expect(result.added).toHaveLength(0);
    });
  });
});
