import { Test, TestingModule } from '@nestjs/testing';
import { FactsController } from './facts.controller';
import { FactsService } from './facts.service';
import { CreateFactDto, QueryFactsDto } from './dto';

describe('FactsController', () => {
  let controller: FactsController;
  let service: FactsService;

  const mockFactsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findChildren: jest.fn(),
    create: jest.fn(),
    getStats: jest.fn(),
  };

  const mockRequest = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FactsController],
      providers: [
        {
          provide: FactsService,
          useValue: mockFactsService,
        },
      ],
    }).compile();

    controller = module.get<FactsController>(FactsController);
    service = module.get<FactsService>(FactsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStats', () => {
    it('統計情報を取得できること', async () => {
      const mockStats = { todayCount: 42 };
      mockFactsService.getStats.mockResolvedValue(mockStats);

      const result = await controller.getStats(mockRequest);

      expect(result).toEqual(mockStats);
      expect(service.getStats).toHaveBeenCalledWith('user-123');
    });
  });

  describe('findAll', () => {
    const mockFacts = {
      data: [
        {
          id: 'fact-1',
          title: 'Test Fact 1',
          source: 'github',
          occurredAt: new Date('2024-01-01'),
        },
        {
          id: 'fact-2',
          title: 'Test Fact 2',
          source: 'slack',
          occurredAt: new Date('2024-01-02'),
        },
      ],
      meta: {
        hasMore: false,
        nextCursor: undefined,
      },
    };

    it('全ての記録を取得できること', async () => {
      const query: QueryFactsDto = {};
      mockFactsService.findAll.mockResolvedValue(mockFacts);

      const result = await controller.findAll(mockRequest, query);

      expect(result).toEqual(mockFacts);
      expect(service.findAll).toHaveBeenCalledWith('user-123', query);
    });

    it('クエリパラメータを渡して記録を取得できること', async () => {
      const query: QueryFactsDto = {
        source: 'github',
        type: 'commit',
        limit: 10,
      };
      mockFactsService.findAll.mockResolvedValue(mockFacts);

      const result = await controller.findAll(mockRequest, query);

      expect(result).toEqual(mockFacts);
      expect(service.findAll).toHaveBeenCalledWith('user-123', query);
    });

    it('日時範囲を指定して記録を取得できること', async () => {
      const query: QueryFactsDto = {
        from: '2024-01-01',
        to: '2024-01-31',
      };
      mockFactsService.findAll.mockResolvedValue(mockFacts);

      const result = await controller.findAll(mockRequest, query);

      expect(result).toEqual(mockFacts);
      expect(service.findAll).toHaveBeenCalledWith('user-123', query);
    });

    it('カーソルを指定して記録を取得できること', async () => {
      const query: QueryFactsDto = {
        cursor: 'fact-123',
        limit: 20,
      };
      mockFactsService.findAll.mockResolvedValue(mockFacts);

      const result = await controller.findAll(mockRequest, query);

      expect(result).toEqual(mockFacts);
      expect(service.findAll).toHaveBeenCalledWith('user-123', query);
    });
  });

  describe('findChildren', () => {
    it('子 Fact 一覧を取得できること', async () => {
      const mockChildren = {
        data: [
          {
            id: 'child-1',
            title: 'Child Fact',
            source: 'github',
            type: 'issue.closed',
          },
        ],
      };
      mockFactsService.findChildren.mockResolvedValue(mockChildren);

      const result = await controller.findChildren(mockRequest, 'parent-1');

      expect(result).toEqual(mockChildren);
      expect(service.findChildren).toHaveBeenCalledWith('user-123', 'parent-1');
    });
  });

  describe('findOne', () => {
    const mockFact = {
      data: {
        id: 'fact-1',
        externalId: 'ext-1',
        source: 'github',
        sourceUrl: 'https://github.com/test/repo/issues/123',
        occurredAt: new Date('2024-01-01'),
        title: 'Test Fact',
        summary: 'Summary',
        content: 'Content',
        type: 'issue.opened',
        metadata: {},
        userId: 'user-123',
        createdAt: new Date('2024-01-01'),
      },
    };

    it('IDで記録を取得できること', async () => {
      const factId = 'fact-1';
      mockFactsService.findOne.mockResolvedValue(mockFact);

      const result = await controller.findOne(mockRequest, factId);

      expect(result).toEqual(mockFact);
      expect(service.findOne).toHaveBeenCalledWith('user-123', factId);
    });
  });

  describe('create', () => {
    const createDto: CreateFactDto = {
      source: 'github',
      sourceUrl: 'https://github.com/test/repo/issues/123',
      title: 'New Fact',
      summary: 'New Summary',
      content: 'New Content',
      type: 'issue.opened',
      raw: { original: 'data' },
    };

    const mockCreatedFact = {
      data: {
        id: 'fact-new',
        externalId: 'manual-uuid-123',
        source: 'github',
        sourceUrl: 'https://github.com/test/repo/issues/123',
        occurredAt: new Date('2024-01-01'),
        title: 'New Fact',
        summary: 'New Summary',
        content: 'New Content',
        type: 'issue.opened',
        metadata: null,
        userId: 'user-123',
        createdAt: new Date('2024-01-01'),
      },
    };

    it('新しい記録を作成できること', async () => {
      mockFactsService.create.mockResolvedValue(mockCreatedFact);

      const result = await controller.create(mockRequest, createDto);

      expect(result).toEqual(mockCreatedFact);
      expect(service.create).toHaveBeenCalledWith('user-123', createDto);
    });

    it('全てのフィールドを指定して記録を作成できること', async () => {
      const fullDto: CreateFactDto = {
        ...createDto,
        externalId: 'custom-ext-id',
        occurredAt: '2024-01-01T12:00:00Z',
        metadata: { tag: 'important' },
      };
      mockFactsService.create.mockResolvedValue(mockCreatedFact);

      const result = await controller.create(mockRequest, fullDto);

      expect(result).toEqual(mockCreatedFact);
      expect(service.create).toHaveBeenCalledWith('user-123', fullDto);
    });
  });
});
