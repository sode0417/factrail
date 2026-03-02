import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RepositoriesService } from './repositories.service';
import { PrismaService } from '../prisma.service';
import { IntegrationsService } from '../integrations/integrations.service';
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
    it('リポジトリを追加できること', async () => {
      const repoInfo = {
        fullName: 'testuser/repo1',
        name: 'repo1',
        owner: 'testuser',
        isPrivate: false,
        htmlUrl: 'https://github.com/testuser/repo1',
      };
      mockGitHubApiService.getRepository.mockResolvedValue(repoInfo);
      mockPrismaService.repository.findUnique.mockResolvedValue(null);

      const createdRepo = {
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
      };
      mockPrismaService.repository.create.mockResolvedValue(createdRepo);

      const result = await service.add(userId, 'testuser/repo1');

      expect(result).toEqual(createdRepo);
      expect(mockGitHubApiService.getRepository).toHaveBeenCalledWith(
        'test-token',
        'testuser/repo1',
      );
    });

    it('GitHubにリポジトリが存在しない場合はNotFoundExceptionをスローすること', async () => {
      mockGitHubApiService.getRepository.mockResolvedValue(null);

      await expect(service.add(userId, 'testuser/nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('既に登録済みの場合はBadRequestExceptionをスローすること', async () => {
      const repoInfo = {
        fullName: 'testuser/repo1',
        name: 'repo1',
        owner: 'testuser',
        isPrivate: false,
        htmlUrl: 'https://github.com/testuser/repo1',
      };
      mockGitHubApiService.getRepository.mockResolvedValue(repoInfo);
      mockPrismaService.repository.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.add(userId, 'testuser/repo1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('リポジトリを削除できること', async () => {
      const mockRepo = {
        id: 'repo-1',
        integrationId: 'int-1',
        fullName: 'testuser/repo1',
      };
      mockPrismaService.repository.findFirst.mockResolvedValue(mockRepo);
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
