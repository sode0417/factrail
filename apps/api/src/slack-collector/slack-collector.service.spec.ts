import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WebClient } from '@slack/web-api';
import { SlackCollectorService } from './slack-collector.service';
import { PrismaService } from '../prisma.service';
import { CronHealthService } from '../health/cron-health.service';

jest.mock('@slack/web-api', () => ({ WebClient: jest.fn() }));

describe('SlackCollectorService（cron の鮮度の報告）', () => {
  const mockPrisma = {
    user: { findFirst: jest.fn() },
    fact: { upsert: jest.fn() },
  };
  const mockCronHealth = {
    register: jest.fn(),
    recordSuccess: jest.fn(),
    recordFailure: jest.fn(),
  };
  const mockClient = {
    auth: { test: jest.fn() },
    conversations: { open: jest.fn(), history: jest.fn(), replies: jest.fn() },
  };

  const fullConfig: Record<string, string> = {
    SLACK_BOT_TOKEN_WORK: 'xoxb-test',
    SLACK_USER_ID_WORK: 'U123',
  };

  const build = async (config: Record<string, string>) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlackCollectorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: { get: (key: string) => config[key] } },
        { provide: CronHealthService, useValue: mockCronHealth },
      ],
    }).compile();
    return module.get<SlackCollectorService>(SlackCollectorService);
  };

  beforeEach(() => {
    (WebClient as unknown as jest.Mock).mockImplementation(() => mockClient);
    mockClient.auth.test.mockResolvedValue({ team_id: 'T1' });
    mockClient.conversations.open.mockResolvedValue({ channel: { id: 'D1' } });
    mockClient.conversations.history.mockResolvedValue({ messages: [] });
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('トークンとユーザー ID が揃っていれば有効として登録されること', async () => {
    await build(fullConfig);

    expect(mockCronHealth.register).toHaveBeenCalledWith(
      'slack-collector',
      expect.objectContaining({ enabled: true }),
    );
  });

  it('トークンが無ければ無効として登録され、実行しても何も記録しないこと', async () => {
    const service = await build({ SLACK_USER_ID_WORK: 'U123' });

    await service.collectSlackMessages();

    expect(mockCronHealth.register).toHaveBeenCalledWith(
      'slack-collector',
      expect.objectContaining({ enabled: false }),
    );
    expect(mockCronHealth.recordSuccess).not.toHaveBeenCalled();
    expect(mockCronHealth.recordFailure).not.toHaveBeenCalled();
  });

  it('メッセージが 0 件でも最後まで取得できれば成功として記録すること', async () => {
    const service = await build(fullConfig);

    await service.collectSlackMessages();

    expect(mockCronHealth.recordSuccess).toHaveBeenCalledWith('slack-collector');
    expect(mockCronHealth.recordFailure).not.toHaveBeenCalled();
  });

  it('team_id が取れなければ失敗として記録すること', async () => {
    mockClient.auth.test.mockResolvedValue({});
    const service = await build(fullConfig);

    await service.collectSlackMessages();

    expect(mockCronHealth.recordFailure).toHaveBeenCalledWith('slack-collector');
    expect(mockCronHealth.recordSuccess).not.toHaveBeenCalled();
  });

  it('DM チャンネルが開けなければ失敗として記録すること', async () => {
    mockClient.conversations.open.mockResolvedValue({});
    const service = await build(fullConfig);

    await service.collectSlackMessages();

    expect(mockCronHealth.recordFailure).toHaveBeenCalledWith('slack-collector');
  });

  it('Fact を紐付けるユーザーがいなければ失敗として記録すること', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const service = await build(fullConfig);

    await service.collectSlackMessages();

    expect(mockCronHealth.recordFailure).toHaveBeenCalledWith('slack-collector');
  });

  it('Slack API が例外を投げたら失敗として記録すること', async () => {
    mockClient.auth.test.mockRejectedValue(new Error('invalid_auth'));
    const service = await build(fullConfig);

    await expect(service.collectSlackMessages()).resolves.toBeUndefined();

    expect(mockCronHealth.recordFailure).toHaveBeenCalledWith('slack-collector');
    expect(mockCronHealth.recordSuccess).not.toHaveBeenCalled();
  });
});
