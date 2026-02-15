import { Test, TestingModule } from '@nestjs/testing';
import { RepositoriesController } from './repositories.controller';
import { RepositoriesService } from './repositories.service';

describe('RepositoriesController', () => {
  let controller: RepositoriesController;
  let service: RepositoriesService;

  const mockRepositoriesService = {
    findAll: jest.fn(),
    getAvailableRepositories: jest.fn(),
    add: jest.fn(),
    remove: jest.fn(),
    detectFromFacts: jest.fn(),
  };

  const mockRequest = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RepositoriesController],
      providers: [
        {
          provide: RepositoriesService,
          useValue: mockRepositoriesService,
        },
      ],
    }).compile();

    controller = module.get<RepositoriesController>(RepositoriesController);
    service = module.get<RepositoriesService>(RepositoriesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('登録済みリポジトリ一覧を取得できること', async () => {
      const mockRepos = [
        {
          id: 'repo-1',
          fullName: 'test/repo1',
          owner: 'test',
          name: 'repo1',
          isPrivate: false,
          status: 'active',
        },
      ];
      mockRepositoriesService.findAll.mockResolvedValue(mockRepos);

      const result = await controller.findAll(mockRequest);

      expect(result).toEqual(mockRepos);
      expect(service.findAll).toHaveBeenCalledWith('user-123');
    });
  });

  describe('getAvailable', () => {
    it('GitHub APIからリポジトリ候補を取得できること', async () => {
      const mockAvailable = [
        {
          fullName: 'test/repo1',
          name: 'repo1',
          owner: 'test',
          isPrivate: false,
          htmlUrl: 'https://github.com/test/repo1',
        },
      ];
      mockRepositoriesService.getAvailableRepositories.mockResolvedValue(mockAvailable);

      const result = await controller.getAvailable(mockRequest);

      expect(result).toEqual(mockAvailable);
      expect(service.getAvailableRepositories).toHaveBeenCalledWith('user-123');
    });
  });

  describe('add', () => {
    it('リポジトリを追加できること', async () => {
      const mockRepo = {
        id: 'repo-1',
        fullName: 'test/repo1',
        owner: 'test',
        name: 'repo1',
        isPrivate: false,
        status: 'active',
      };
      mockRepositoriesService.add.mockResolvedValue(mockRepo);

      const result = await controller.add(mockRequest, { fullName: 'test/repo1' });

      expect(result).toEqual(mockRepo);
      expect(service.add).toHaveBeenCalledWith('user-123', 'test/repo1');
    });
  });

  describe('remove', () => {
    it('リポジトリを削除できること', async () => {
      mockRepositoriesService.remove.mockResolvedValue(undefined);

      await controller.remove(mockRequest, 'repo-1');

      expect(service.remove).toHaveBeenCalledWith('user-123', 'repo-1');
    });
  });

  describe('detect', () => {
    it('既存Factsからリポジトリを自動検出できること', async () => {
      const mockResult = { added: ['test/repo1', 'test/repo2'] };
      mockRepositoriesService.detectFromFacts.mockResolvedValue(mockResult);

      const result = await controller.detect(mockRequest);

      expect(result).toEqual(mockResult);
      expect(service.detectFromFacts).toHaveBeenCalledWith('user-123');
    });
  });
});
