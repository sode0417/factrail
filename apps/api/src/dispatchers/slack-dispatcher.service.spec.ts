import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException, Logger } from '@nestjs/common';
import { SlackDispatcherService } from './slack-dispatcher.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { SettingsService } from '../settings/settings.service';
import { Fact } from '@prisma/client';

// Mock @slack/web-api
jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => ({
    chat: {
      postMessage: jest.fn(),
    },
  })),
}));

describe('SlackDispatcherService', () => {
  let service: SlackDispatcherService;
  let integrationsService: IntegrationsService;
  let settingsService: SettingsService;
  let mockWebClient: any;

  const mockIntegrationsService = {
    findByProvider: jest.fn(),
  };

  const mockSettingsService = {
    getDecryptedValue: jest.fn(),
  };

  const mockFact: Fact = {
    id: 'fact-1',
    externalId: 'ext-1',
    source: 'github',
    sourceUrl: 'https://github.com/test/repo/issues/123',
    occurredAt: new Date('2024-01-01T12:00:00Z'),
    title: '[test/repo] Issue #123: Test Issue',
    summary: 'This is a test issue',
    content: 'Full content of the issue',
    raw: {},
    type: 'issue.opened',
    metadata: {},
    userId: 'user-123',
    slackMessageId: null,
    f2aEventId: null,
    createdAt: new Date('2024-01-01T12:00:00Z'),
    processedAt: null,
  };

  beforeEach(async () => {
    const { WebClient } = require('@slack/web-api');
    mockWebClient = {
      chat: {
        postMessage: jest.fn(),
      },
    };
    WebClient.mockImplementation(() => mockWebClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlackDispatcherService,
        {
          provide: IntegrationsService,
          useValue: mockIntegrationsService,
        },
        {
          provide: SettingsService,
          useValue: mockSettingsService,
        },
      ],
    }).compile();

    service = module.get<SlackDispatcherService>(SlackDispatcherService);
    integrationsService = module.get<IntegrationsService>(IntegrationsService);
    settingsService = module.get<SettingsService>(SettingsService);

    // Disable logging during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('postFactToDM', () => {
    const mockIntegration = {
      id: 'int-1',
      userId: 'user-123',
      provider: 'slack',
      accountId: 'team-123',
      accountName: 'Test Team',
      accessToken: 'xoxb-test-token',
      refreshToken: null,
      expiresAt: null,
      scope: ['chat:write'],
      status: 'active',
      lastSyncAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockIntegrationsService.findByProvider.mockResolvedValue([mockIntegration]);
      mockSettingsService.getDecryptedValue.mockResolvedValue('C123456789');
      mockWebClient.chat.postMessage.mockResolvedValue({
        ok: true,
        ts: '1234567890.123456',
        channel: 'C123456789',
      });
    });

    it('SlackにFactを投稿できること', async () => {
      const result = await service.postFactToDM(mockFact);

      expect(result).toBe('1234567890.123456');
      expect(integrationsService.findByProvider).toHaveBeenCalledWith('user-123', 'slack');
      expect(settingsService.getDecryptedValue).toHaveBeenCalledWith('slack', 'target_channel_id');
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C123456789',
        blocks: expect.any(Array),
        text: mockFact.title,
      });
    });

    it('Slack連携が設定されていない場合はエラーをスローすること', async () => {
      mockIntegrationsService.findByProvider.mockResolvedValue([]);

      await expect(service.postFactToDM(mockFact)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.postFactToDM(mockFact)).rejects.toThrow(
        'Slack連携が設定されていません',
      );
    });

    it('Slack連携がnullの場合はエラーをスローすること', async () => {
      mockIntegrationsService.findByProvider.mockResolvedValue(null);

      await expect(service.postFactToDM(mockFact)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('送信先IDが設定されていない場合はエラーをスローすること', async () => {
      mockSettingsService.getDecryptedValue.mockResolvedValue(null);

      await expect(service.postFactToDM(mockFact)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.postFactToDM(mockFact)).rejects.toThrow(
        'Slack送信先ID（User/Channel）が設定されていません',
      );
    });

    it('Slack APIエラーをスローすること', async () => {
      const error = new Error('Slack API error');
      mockWebClient.chat.postMessage.mockRejectedValue(error);

      await expect(service.postFactToDM(mockFact)).rejects.toThrow(error);
    });

    it('GitHubソースの場合は正しいブロックを生成すること', async () => {
      await service.postFactToDM(mockFact);

      const call = mockWebClient.chat.postMessage.mock.calls[0][0];
      const blocks = call.blocks;

      expect(blocks[0]).toEqual({
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🐙 新しいFact',
        },
      });
      expect(blocks[1]).toEqual({
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*タイトル:*\n${mockFact.title}`,
          },
          {
            type: 'mrkdwn',
            text: '*ソース:*\ngithub',
          },
        ],
      });
    });

    it('summaryがある場合はブロックに含まれること', async () => {
      await service.postFactToDM(mockFact);

      const call = mockWebClient.chat.postMessage.mock.calls[0][0];
      const blocks = call.blocks;

      const summaryBlock = blocks.find(
        (block: any) => block.type === 'section' && block.text?.text === mockFact.summary,
      );
      expect(summaryBlock).toBeDefined();
    });

    it('summaryがない場合はブロックに含まれないこと', async () => {
      const factWithoutSummary = { ...mockFact, summary: null };
      await service.postFactToDM(factWithoutSummary);

      const call = mockWebClient.chat.postMessage.mock.calls[0][0];
      const blocks = call.blocks;

      const summaryBlock = blocks.find(
        (block: any) => block.type === 'section' && block.text?.text === null,
      );
      expect(summaryBlock).toBeUndefined();
    });

    it('sourceUrlがある場合はブロックに含まれること', async () => {
      await service.postFactToDM(mockFact);

      const call = mockWebClient.chat.postMessage.mock.calls[0][0];
      const blocks = call.blocks;

      const urlBlock = blocks.find(
        (block: any) =>
          block.type === 'section' &&
          block.text?.text?.includes(mockFact.sourceUrl),
      );
      expect(urlBlock).toBeDefined();
    });

    it('sourceUrlがない場合はブロックに含まれないこと', async () => {
      const factWithoutUrl = { ...mockFact, sourceUrl: null };
      await service.postFactToDM(factWithoutUrl);

      const call = mockWebClient.chat.postMessage.mock.calls[0][0];
      const blocks = call.blocks;

      const urlBlock = blocks.find(
        (block: any) => block.text?.text?.includes('詳細を見る'),
      );
      expect(urlBlock).toBeUndefined();
    });

    it('contextブロックが含まれること', async () => {
      await service.postFactToDM(mockFact);

      const call = mockWebClient.chat.postMessage.mock.calls[0][0];
      const blocks = call.blocks;

      const contextBlock = blocks.find((block: any) => block.type === 'context');
      expect(contextBlock).toBeDefined();
      expect(contextBlock.elements[0].text).toContain('発生:');
      expect(contextBlock.elements[0].text).toContain('タイプ:');
    });

    it('Slackソースの場合は正しい絵文字を使用すること', async () => {
      const slackFact = { ...mockFact, source: 'slack' };
      await service.postFactToDM(slackFact);

      const call = mockWebClient.chat.postMessage.mock.calls[0][0];
      const blocks = call.blocks;

      expect(blocks[0].text.text).toBe('💬 新しいFact');
    });

    it('Googleソースの場合は正しい絵文字を使用すること', async () => {
      const googleFact = { ...mockFact, source: 'google' };
      await service.postFactToDM(googleFact);

      const call = mockWebClient.chat.postMessage.mock.calls[0][0];
      const blocks = call.blocks;

      expect(blocks[0].text.text).toBe('📅 新しいFact');
    });

    it('manualソースの場合は正しい絵文字を使用すること', async () => {
      const manualFact = { ...mockFact, source: 'manual' };
      await service.postFactToDM(manualFact);

      const call = mockWebClient.chat.postMessage.mock.calls[0][0];
      const blocks = call.blocks;

      expect(blocks[0].text.text).toBe('✍️ 新しいFact');
    });

    it('未知のソースの場合はデフォルト絵文字を使用すること', async () => {
      const unknownFact = { ...mockFact, source: 'unknown' };
      await service.postFactToDM(unknownFact);

      const call = mockWebClient.chat.postMessage.mock.calls[0][0];
      const blocks = call.blocks;

      expect(blocks[0].text.text).toBe('📌 新しいFact');
    });
  });
});
