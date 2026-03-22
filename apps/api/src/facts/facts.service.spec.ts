import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FactsService } from './facts.service';
import { PrismaService } from '../prisma.service';
import { CreateFactDto, QueryFactsDto } from './dto';

describe('FactsService', () => {
  let service: FactsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    fact: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FactsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<FactsService>(FactsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    const userId = 'user-123';
    const mockFacts = [
      {
        id: 'fact-1',
        externalId: 'ext-1',
        source: 'github',
        sourceUrl: 'https://github.com/test',
        occurredAt: new Date('2024-01-01'),
        title: 'Test Fact 1',
        summary: 'Summary 1',
        type: 'commit',
        metadata: {},
        createdAt: new Date('2024-01-01'),
      },
      {
        id: 'fact-2',
        externalId: 'ext-2',
        source: 'slack',
        sourceUrl: 'https://slack.com/test',
        occurredAt: new Date('2024-01-02'),
        title: 'Test Fact 2',
        summary: 'Summary 2',
        type: 'message',
        metadata: {},
        createdAt: new Date('2024-01-02'),
      },
    ];

    it('全ての記録を取得できること', async () => {
      mockPrismaService.fact.findMany.mockResolvedValue(mockFacts);

      const query: QueryFactsDto = {};
      const result = await service.findAll(userId, query);

      expect(result.data).toEqual(mockFacts);
      expect(result.meta.hasMore).toBe(false);
      expect(result.meta.nextCursor).toBeUndefined();
      expect(prisma.fact.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { occurredAt: 'desc' },
        take: 51,
        select: {
          id: true,
          externalId: true,
          source: true,
          sourceUrl: true,
          occurredAt: true,
          title: true,
          summary: true,
          type: true,
          metadata: true,
          createdAt: true,
          groupId: true,
          groupType: true,
          projectId: true,
          categoryId: true,
        },
      });
    });

    it('ソースでフィルタリングできること', async () => {
      const filteredFacts = [mockFacts[0]];
      mockPrismaService.fact.findMany.mockResolvedValue(filteredFacts);

      const query: QueryFactsDto = { source: 'github' };
      const result = await service.findAll(userId, query);

      expect(result.data).toEqual(filteredFacts);
      expect(prisma.fact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            source: 'github',
          }),
        }),
      );
    });

    it('タイプでフィルタリングできること', async () => {
      const filteredFacts = [mockFacts[0]];
      mockPrismaService.fact.findMany.mockResolvedValue(filteredFacts);

      const query: QueryFactsDto = { type: 'commit' };
      const result = await service.findAll(userId, query);

      expect(result.data).toEqual(filteredFacts);
      expect(prisma.fact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            type: 'commit',
          }),
        }),
      );
    });

    it('日時範囲でフィルタリングできること', async () => {
      mockPrismaService.fact.findMany.mockResolvedValue(mockFacts);

      const query: QueryFactsDto = {
        from: '2024-01-01',
        to: '2024-01-31',
      };
      await service.findAll(userId, query);

      expect(prisma.fact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            occurredAt: {
              gte: new Date('2024-01-01'),
              lte: new Date('2024-01-31'),
            },
          }),
        }),
      );
    });

    it('カーソルベースページネーションが正しく機能すること', async () => {
      mockPrismaService.fact.findMany.mockResolvedValue(mockFacts);

      const query: QueryFactsDto = { cursor: 'fact-0' };
      await service.findAll(userId, query);

      expect(prisma.fact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'fact-0' },
          skip: 1,
        }),
      );
    });

    it('次ページがある場合にhasMoreとnextCursorが設定されること', async () => {
      const manyFacts = Array.from({ length: 51 }, (_, i) => ({
        ...mockFacts[0],
        id: `fact-${i}`,
      }));
      mockPrismaService.fact.findMany.mockResolvedValue(manyFacts);

      const query: QueryFactsDto = { limit: 50 };
      const result = await service.findAll(userId, query);

      expect(result.data).toHaveLength(50);
      expect(result.meta.hasMore).toBe(true);
      expect(result.meta.nextCursor).toBe('fact-49');
    });

    it('次ページがない場合にhasMoreがfalseであること', async () => {
      mockPrismaService.fact.findMany.mockResolvedValue(mockFacts);

      const query: QueryFactsDto = { limit: 50 };
      const result = await service.findAll(userId, query);

      expect(result.data).toHaveLength(2);
      expect(result.meta.hasMore).toBe(false);
      expect(result.meta.nextCursor).toBeUndefined();
    });
  });

  describe('findAll (grouped)', () => {
    const userId = 'user-123';

    it('grouped=true の場合、親のみ + ungrouped を取得し childCount を含めること', async () => {
      const mockGroupedFacts = [
        {
          id: 'fact-parent',
          externalId: 'ext-1',
          source: 'github',
          sourceUrl: null,
          occurredAt: new Date('2024-01-01'),
          title: 'Parent Fact',
          summary: null,
          type: 'issue.opened',
          metadata: {},
          createdAt: new Date('2024-01-01'),
          groupId: 'github:test/repo:issue:1',
          groupType: 'issue',
          _count: { children: 2 },
        },
      ];
      mockPrismaService.fact.findMany.mockResolvedValue(mockGroupedFacts);

      const query: QueryFactsDto = { grouped: 'true' };
      const result = await service.findAll(userId, query);

      expect(result.data[0]).toHaveProperty('childCount', 2);
      expect(result.data[0]).not.toHaveProperty('_count');
      expect(prisma.fact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ groupId: null }, { parentId: null }],
          }),
          select: expect.objectContaining({
            _count: { select: { children: true } },
          }),
        }),
      );
    });
  });

  describe('findChildren', () => {
    const userId = 'user-123';

    it('親 Fact の子 Fact 一覧を取得できること', async () => {
      const mockParent = { id: 'parent-1', userId };
      const mockChildren = [
        {
          id: 'child-1',
          externalId: 'ext-child-1',
          source: 'github',
          sourceUrl: null,
          occurredAt: new Date('2024-01-02'),
          title: 'Child 1',
          summary: null,
          type: 'issue.closed',
          metadata: {},
          createdAt: new Date('2024-01-02'),
          groupId: 'github:test/repo:issue:1',
          groupType: 'issue',
        },
      ];
      mockPrismaService.fact.findFirst.mockResolvedValue(mockParent);
      mockPrismaService.fact.findMany.mockResolvedValue(mockChildren);

      const result = await service.findChildren(userId, 'parent-1');

      expect(result.data).toEqual(mockChildren);
      expect(prisma.fact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { parentId: 'parent-1', userId },
          orderBy: { occurredAt: 'asc' },
        }),
      );
    });

    it('親 Fact が見つからない場合は NotFoundException をスローすること', async () => {
      mockPrismaService.fact.findFirst.mockResolvedValue(null);

      await expect(service.findChildren(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    const userId = 'user-123';
    const factId = 'fact-1';
    const mockFact = {
      id: factId,
      externalId: 'ext-1',
      source: 'github',
      sourceUrl: 'https://github.com/test',
      occurredAt: new Date('2024-01-01'),
      title: 'Test Fact',
      summary: 'Summary',
      content: 'Content',
      raw: {},
      type: 'commit',
      metadata: {},
      userId,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    it('IDで記録を取得できること', async () => {
      mockPrismaService.fact.findFirst.mockResolvedValue(mockFact);

      const result = await service.findOne(userId, factId);

      expect(result.data).toEqual(mockFact);
      expect(prisma.fact.findFirst).toHaveBeenCalledWith({
        where: {
          id: factId,
          userId,
        },
      });
    });

    it('記録が見つからない場合にNotFoundExceptionをスローすること', async () => {
      mockPrismaService.fact.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, factId)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(userId, factId)).rejects.toThrow(
        `記録が見つかりません: ID "${factId}"`,
      );
    });

    it('他のユーザーの記録は取得できないこと', async () => {
      mockPrismaService.fact.findFirst.mockResolvedValue(null);

      await expect(service.findOne('other-user', factId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const userId = 'user-123';
    const createDto: CreateFactDto = {
      source: 'github',
      sourceUrl: 'https://github.com/test',
      title: 'New Fact',
      summary: 'New Summary',
      content: 'New Content',
      type: 'commit',
      raw: { original: 'data' },
    };

    const mockCreatedFact = {
      id: 'fact-new',
      externalId: 'ext-new',
      source: 'github',
      sourceUrl: 'https://github.com/test',
      occurredAt: new Date('2024-01-01'),
      title: 'New Fact',
      summary: 'New Summary',
      content: 'New Content',
      raw: null,
      type: 'commit',
      metadata: null,
      userId,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    it('新しい記録を作成できること', async () => {
      mockPrismaService.fact.create.mockResolvedValue(mockCreatedFact);

      const result = await service.create(userId, createDto);

      expect(result.data).toEqual(mockCreatedFact);
      expect(prisma.fact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            source: createDto.source,
            sourceUrl: createDto.sourceUrl,
            title: createDto.title,
            summary: createDto.summary,
            content: createDto.content,
            type: createDto.type,
          }),
        }),
      );
    });

    it('externalIdが指定されている場合はそれを使用すること', async () => {
      const dtoWithExternalId = {
        ...createDto,
        externalId: 'custom-ext-id',
      };
      mockPrismaService.fact.create.mockResolvedValue(mockCreatedFact);

      await service.create(userId, dtoWithExternalId);

      expect(prisma.fact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            externalId: 'custom-ext-id',
          }),
        }),
      );
    });

    it('externalIdが指定されていない場合はmanual-UUIDを生成すること', async () => {
      mockPrismaService.fact.create.mockResolvedValue(mockCreatedFact);

      await service.create(userId, createDto);

      const call = mockPrismaService.fact.create.mock.calls[0][0];
      expect(call.data.externalId).toMatch(/^manual-[0-9a-f-]{36}$/);
    });

    it('occurredAtが指定されている場合はそれを使用すること', async () => {
      const dtoWithOccurredAt = {
        ...createDto,
        occurredAt: '2024-06-01T12:00:00Z',
      };
      mockPrismaService.fact.create.mockResolvedValue(mockCreatedFact);

      await service.create(userId, dtoWithOccurredAt);

      expect(prisma.fact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            occurredAt: new Date('2024-06-01T12:00:00Z'),
          }),
        }),
      );
    });

    it('occurredAtが指定されていない場合は現在時刻を使用すること', async () => {
      mockPrismaService.fact.create.mockResolvedValue(mockCreatedFact);

      const beforeCreate = new Date();
      await service.create(userId, createDto);
      const afterCreate = new Date();

      const call = mockPrismaService.fact.create.mock.calls[0][0];
      const occurredAt = call.data.occurredAt;

      expect(occurredAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(occurredAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });

    it('rawとmetadataが指定されている場合はそれを使用すること', async () => {
      const dtoWithExtra = {
        ...createDto,
        raw: { original: 'data' },
        metadata: { tag: 'important' },
      };
      mockPrismaService.fact.create.mockResolvedValue(mockCreatedFact);

      await service.create(userId, dtoWithExtra);

      expect(prisma.fact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            raw: { original: 'data' },
            metadata: { tag: 'important' },
          }),
        }),
      );
    });
  });

  describe('getStats', () => {
    const userId = 'user-123';

    it('直近24時間の記録数を取得できること', async () => {
      mockPrismaService.fact.count.mockResolvedValue(42);

      const result = await service.getStats(userId);

      expect(result.todayCount).toBe(42);
      expect(prisma.fact.count).toHaveBeenCalledWith({
        where: {
          userId,
          occurredAt: {
            gte: expect.any(Date),
          },
        },
      });
    });

    it('24時間前の日時が正しく計算されること', async () => {
      mockPrismaService.fact.count.mockResolvedValue(10);

      const beforeCall = new Date();
      await service.getStats(userId);
      const afterCall = new Date();

      const call = mockPrismaService.fact.count.mock.calls[0][0];
      const oneDayAgo = call.where.occurredAt.gte;

      const expectedOneDayAgo = new Date(beforeCall.getTime() - 24 * 60 * 60 * 1000);
      const expectedOneDayAgoAfter = new Date(afterCall.getTime() - 24 * 60 * 60 * 1000);

      expect(oneDayAgo.getTime()).toBeGreaterThanOrEqual(expectedOneDayAgo.getTime());
      expect(oneDayAgo.getTime()).toBeLessThanOrEqual(expectedOneDayAgoAfter.getTime());
    });

    it('記録がない場合は0を返すこと', async () => {
      mockPrismaService.fact.count.mockResolvedValue(0);

      const result = await service.getStats(userId);

      expect(result.todayCount).toBe(0);
    });
  });
});
