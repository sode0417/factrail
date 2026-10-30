import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BrowserCollectorService } from './browser-collector.service';
import { ChromeHistoryService } from './chrome-history.service';
import { SessionSplitterService } from './session-splitter.service';
import { LlmService } from './llm.service';
import { PrismaService } from '../prisma.service';
import { CronHealthService } from '../health/cron-health.service';

describe('BrowserCollectorService（cron の鮮度の報告）', () => {
  let service: BrowserCollectorService;

  const mockPrisma = {
    user: { findFirst: jest.fn() },
    fact: { upsert: jest.fn() },
  };
  const mockChromeHistory = { fetchNewVisits: jest.fn() };
  const mockSessionSplitter = { splitIntoSessions: jest.fn() };
  const mockLlm = { summarizeSession: jest.fn() };
  const mockCronHealth = {
    register: jest.fn(),
    recordSuccess: jest.fn(),
    recordFailure: jest.fn(),
  };

  const session = {
    startTime: new Date('2026-10-27T00:00:00Z'),
    primaryUrl: 'https://example.com',
    domains: ['example.com'],
    visitCount: 3,
    durationMin: 10,
    searchQueries: [],
    visits: [{ url: 'https://example.com', title: 'Example' }],
  };

  const build = async (enabled: string) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrowserCollectorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(enabled) } },
        { provide: ChromeHistoryService, useValue: mockChromeHistory },
        { provide: SessionSplitterService, useValue: mockSessionSplitter },
        { provide: LlmService, useValue: mockLlm },
        { provide: CronHealthService, useValue: mockCronHealth },
      ],
    }).compile();
    return module.get<BrowserCollectorService>(BrowserCollectorService);
  };

  beforeEach(async () => {
    service = await build('true');
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('有効なら鮮度チェックの対象として登録されること', () => {
    expect(mockCronHealth.register).toHaveBeenCalledWith(
      'browser-collector',
      expect.objectContaining({ enabled: true }),
    );
  });

  it('BROWSER_COLLECTOR_ENABLED が true でなければ無効として登録されること', async () => {
    jest.clearAllMocks();
    await build('false');

    expect(mockCronHealth.register).toHaveBeenCalledWith(
      'browser-collector',
      expect.objectContaining({ enabled: false }),
    );
  });

  it('履歴の読取が失敗したら失敗として記録すること（ABI 不一致の再現）', async () => {
    mockChromeHistory.fetchNewVisits.mockImplementation(() => {
      const error = new Error(
        'The module was compiled against a different Node.js version using NODE_MODULE_VERSION 141.',
      ) as Error & { code: string };
      error.code = 'ERR_DLOPEN_FAILED';
      throw error;
    });

    await expect(service.collectBrowserHistory()).resolves.toBeUndefined();

    expect(mockCronHealth.recordFailure).toHaveBeenCalledWith('browser-collector');
    expect(mockCronHealth.recordSuccess).not.toHaveBeenCalled();
  });

  it('新しい訪問が無いだけなら成功として記録すること', async () => {
    mockChromeHistory.fetchNewVisits.mockReturnValue([]);

    await service.collectBrowserHistory();

    expect(mockCronHealth.recordSuccess).toHaveBeenCalledWith('browser-collector');
    expect(mockCronHealth.recordFailure).not.toHaveBeenCalled();
  });

  it('セッションを1件でも保存できたら成功として記録すること', async () => {
    mockChromeHistory.fetchNewVisits.mockReturnValue([{}]);
    mockSessionSplitter.splitIntoSessions.mockReturnValue([session]);
    mockLlm.summarizeSession.mockResolvedValue({ title: 't', summary: 's' });
    mockPrisma.fact.upsert.mockResolvedValue({});

    await service.collectBrowserHistory();

    expect(mockCronHealth.recordSuccess).toHaveBeenCalledWith('browser-collector');
  });

  it('セッションが1件も保存できなければ失敗として記録すること', async () => {
    mockChromeHistory.fetchNewVisits.mockReturnValue([{}]);
    mockSessionSplitter.splitIntoSessions.mockReturnValue([session]);
    mockLlm.summarizeSession.mockRejectedValue(new Error('LLM error'));

    await service.collectBrowserHistory();

    expect(mockCronHealth.recordFailure).toHaveBeenCalledWith('browser-collector');
    expect(mockCronHealth.recordSuccess).not.toHaveBeenCalled();
  });

  it('無効化されていれば何も記録しないこと', async () => {
    service = await build('false');

    await service.collectBrowserHistory();

    expect(mockChromeHistory.fetchNewVisits).not.toHaveBeenCalled();
    expect(mockCronHealth.recordSuccess).not.toHaveBeenCalled();
    expect(mockCronHealth.recordFailure).not.toHaveBeenCalled();
  });
});
