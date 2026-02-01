import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { SlackDispatcherProcessor } from './slack-dispatcher.processor';
import { SlackDispatcherService } from './slack-dispatcher.service';
import { PrismaService } from '../prisma.service';
import { DispatchToSlackDto } from './dto/dispatch-to-slack.dto';

describe('SlackDispatcherProcessor', () => {
  let processor: SlackDispatcherProcessor;
  let slackDispatcherService: SlackDispatcherService;
  let prisma: PrismaService;

  const mockSlackDispatcherService = {
    postFactToDM: jest.fn(),
  };

  const mockPrismaService = {
    fact: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockFact = {
    id: 'fact-1',
    externalId: 'ext-1',
    source: 'github',
    sourceUrl: 'https://github.com/test/repo/issues/123',
    occurredAt: new Date('2024-01-01'),
    title: 'Test Fact',
    summary: 'Summary',
    content: 'Content',
    raw: {},
    type: 'issue.opened',
    metadata: {},
    userId: 'user-123',
    slackMessageId: null,
    f2aEventId: null,
    createdAt: new Date('2024-01-01'),
    processedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlackDispatcherProcessor,
        {
          provide: SlackDispatcherService,
          useValue: mockSlackDispatcherService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    processor = module.get<SlackDispatcherProcessor>(SlackDispatcherProcessor);
    slackDispatcherService = module.get<SlackDispatcherService>(SlackDispatcherService);
    prisma = module.get<PrismaService>(PrismaService);

    // Disable logging during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleSendDM', () => {
    const createMockJob = (data: DispatchToSlackDto): Partial<Job<DispatchToSlackDto>> => ({
      data,
      attemptsMade: 0,
      id: 'job-1',
    });

    it('FactをSlackに投稿してデータベースを更新できること', async () => {
      const jobData: DispatchToSlackDto = { factId: 'fact-1' };
      const job = createMockJob(jobData) as Job<DispatchToSlackDto>;

      mockPrismaService.fact.findUnique.mockResolvedValue(mockFact);
      mockSlackDispatcherService.postFactToDM.mockResolvedValue('1234567890.123456');
      mockPrismaService.fact.update.mockResolvedValue({
        ...mockFact,
        slackMessageId: '1234567890.123456',
        processedAt: new Date(),
      });

      await processor.handleSendDM(job);

      expect(prisma.fact.findUnique).toHaveBeenCalledWith({
        where: { id: 'fact-1' },
      });
      expect(slackDispatcherService.postFactToDM).toHaveBeenCalledWith(mockFact);
      expect(prisma.fact.update).toHaveBeenCalledWith({
        where: { id: 'fact-1' },
        data: {
          slackMessageId: '1234567890.123456',
          processedAt: expect.any(Date),
        },
      });
    });

    it('Factが見つからない場合はエラーをスローすること', async () => {
      const jobData: DispatchToSlackDto = { factId: 'fact-not-found' };
      const job = createMockJob(jobData) as Job<DispatchToSlackDto>;

      mockPrismaService.fact.findUnique.mockResolvedValue(null);

      await expect(processor.handleSendDM(job)).rejects.toThrow('Fact not found: fact-not-found');
      expect(slackDispatcherService.postFactToDM).not.toHaveBeenCalled();
      expect(prisma.fact.update).not.toHaveBeenCalled();
    });

    it('既にSlack投稿済みの場合はスキップすること', async () => {
      const jobData: DispatchToSlackDto = { factId: 'fact-1' };
      const job = createMockJob(jobData) as Job<DispatchToSlackDto>;

      const postedFact = {
        ...mockFact,
        slackMessageId: '1234567890.123456',
      };
      mockPrismaService.fact.findUnique.mockResolvedValue(postedFact);

      await processor.handleSendDM(job);

      expect(slackDispatcherService.postFactToDM).not.toHaveBeenCalled();
      expect(prisma.fact.update).not.toHaveBeenCalled();
    });

    it('Slack投稿失敗時にエラーを再スローすること', async () => {
      const jobData: DispatchToSlackDto = { factId: 'fact-1' };
      const job = createMockJob(jobData) as Job<DispatchToSlackDto>;

      const error = new Error('Slack API error');
      mockPrismaService.fact.findUnique.mockResolvedValue(mockFact);
      mockSlackDispatcherService.postFactToDM.mockRejectedValue(error);

      await expect(processor.handleSendDM(job)).rejects.toThrow(error);
      expect(prisma.fact.update).not.toHaveBeenCalled();
    });

    it('リトライ時にattemptsMadeが増加すること', async () => {
      const jobData: DispatchToSlackDto = { factId: 'fact-1' };
      const job = {
        ...createMockJob(jobData),
        attemptsMade: 2,
      } as Job<DispatchToSlackDto>;

      mockPrismaService.fact.findUnique.mockResolvedValue(mockFact);
      mockSlackDispatcherService.postFactToDM.mockResolvedValue('1234567890.123456');
      mockPrismaService.fact.update.mockResolvedValue({
        ...mockFact,
        slackMessageId: '1234567890.123456',
        processedAt: new Date(),
      });

      await processor.handleSendDM(job);

      // attemptsMade + 1 = 3回目の試行
      expect(prisma.fact.findUnique).toHaveBeenCalled();
      expect(slackDispatcherService.postFactToDM).toHaveBeenCalled();
    });

    it('processedAtが現在時刻で更新されること', async () => {
      const jobData: DispatchToSlackDto = { factId: 'fact-1' };
      const job = createMockJob(jobData) as Job<DispatchToSlackDto>;

      mockPrismaService.fact.findUnique.mockResolvedValue(mockFact);
      mockSlackDispatcherService.postFactToDM.mockResolvedValue('1234567890.123456');
      mockPrismaService.fact.update.mockResolvedValue({
        ...mockFact,
        slackMessageId: '1234567890.123456',
        processedAt: new Date(),
      });

      const beforeCall = new Date();
      await processor.handleSendDM(job);
      const afterCall = new Date();

      const call = mockPrismaService.fact.update.mock.calls[0][0];
      const processedAt = call.data.processedAt;

      expect(processedAt.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(processedAt.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });
  });
});
