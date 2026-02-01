import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, Logger } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { WebhooksService } from './webhooks.service';
import { SettingsService } from '../settings/settings.service';
import { PrismaService } from '../prisma.service';
import { IntegrationsService } from '../integrations/integrations.service';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let settingsService: SettingsService;
  let prisma: PrismaService;
  let integrationsService: IntegrationsService;
  let slackQueue: any;

  const mockSettingsService = {
    getDecryptedValue: jest.fn(),
  };

  const mockPrismaService = {
    fact: {
      upsert: jest.fn(),
    },
    integration: {
      findMany: jest.fn(),
    },
  };

  const mockIntegrationsService = {};

  const mockSlackQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: SettingsService,
          useValue: mockSettingsService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: IntegrationsService,
          useValue: mockIntegrationsService,
        },
        {
          provide: getQueueToken('slack-dispatch'),
          useValue: mockSlackQueue,
        },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    settingsService = module.get<SettingsService>(SettingsService);
    prisma = module.get<PrismaService>(PrismaService);
    integrationsService = module.get<IntegrationsService>(IntegrationsService);
    slackQueue = module.get(getQueueToken('slack-dispatch'));

    // Disable logging during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyGitHubSignature', () => {
    const payload = JSON.stringify({ test: 'data' });
    const secret = 'webhook-secret';

    it('署名が正しい場合は検証に成功すること', async () => {
      mockSettingsService.getDecryptedValue.mockResolvedValue(secret);

      const crypto = require('crypto');
      const signature = `sha256=${crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex')}`;

      await expect(
        service.verifyGitHubSignature(payload, signature),
      ).resolves.toBeUndefined();
    });

    it('署名ヘッダーがない場合はUnauthorizedExceptionをスローすること', async () => {
      await expect(
        service.verifyGitHubSignature(payload, undefined),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.verifyGitHubSignature(payload, undefined),
      ).rejects.toThrow('X-Hub-Signature-256 ヘッダーがありません');
    });

    it('シークレットが設定されていない場合はUnauthorizedExceptionをスローすること', async () => {
      mockSettingsService.getDecryptedValue.mockResolvedValue(null);

      await expect(
        service.verifyGitHubSignature(payload, 'sha256=invalid'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.verifyGitHubSignature(payload, 'sha256=invalid'),
      ).rejects.toThrow('GitHub Webhook シークレットが設定されていません');
    });

    it('署名が不正な場合はUnauthorizedExceptionをスローすること', async () => {
      mockSettingsService.getDecryptedValue.mockResolvedValue(secret);

      const invalidSignature = 'sha256=invalid';

      await expect(
        service.verifyGitHubSignature(payload, invalidSignature),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.verifyGitHubSignature(payload, invalidSignature),
      ).rejects.toThrow('Webhook署名が不正です');
    });
  });

  describe('processGitHubEvent', () => {
    const mockIntegration = {
      id: 'int-1',
      userId: 'user-123',
      provider: 'github',
      accountId: 'gh-123',
      user: { id: 'user-123' },
    };

    const mockFact = {
      id: 'fact-1',
      externalId: 'ext-1',
      source: 'github',
      sourceUrl: 'https://github.com/test',
      occurredAt: new Date('2024-01-01'),
      title: 'Test Fact',
      summary: 'Summary',
      content: 'Content',
      type: 'issue.opened',
      metadata: {},
      raw: {},
      userId: 'user-123',
      slackMessageId: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    beforeEach(() => {
      mockPrismaService.integration.findMany.mockResolvedValue([mockIntegration]);
      mockPrismaService.fact.upsert.mockResolvedValue(mockFact);
      mockSlackQueue.add.mockResolvedValue({});
    });

    describe('issues', () => {
      const issuePayload = {
        action: 'opened',
        issue: {
          number: 123,
          title: 'Test Issue',
          body: 'Issue body',
          html_url: 'https://github.com/test/repo/issues/123',
          user: { login: 'testuser' },
          labels: [{ name: 'bug' }],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        repository: {
          full_name: 'test/repo',
          html_url: 'https://github.com/test/repo',
        },
        sender: {
          login: 'testuser',
        },
      };

      it('issueイベントを処理してFactを作成できること', async () => {
        const result = await service.processGitHubEvent('issues', issuePayload);

        expect(result).toEqual({ factId: 'fact-1' });
        expect(prisma.fact.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              source_externalId: {
                source: 'github',
                externalId: 'test/repo#123',
              },
            },
            create: expect.objectContaining({
              userId: 'user-123',
              source: 'github',
              type: 'issue.opened',
              title: '[test/repo] Issue #123: Test Issue',
            }),
          }),
        );
      });

      it('issueペイロードがない場合はエラーをスローすること', async () => {
        const invalidPayload = {
          action: 'opened',
          repository: {
            full_name: 'test/repo',
            html_url: 'https://github.com/test/repo',
          },
          sender: {
            login: 'testuser',
          },
        };

        await expect(
          service.processGitHubEvent('issues', invalidPayload as any),
        ).rejects.toThrow('Issueペイロードがありません');
      });

      it('GitHub連携が見つからない場合はnullを返すこと', async () => {
        mockPrismaService.integration.findMany.mockResolvedValue([]);

        const result = await service.processGitHubEvent('issues', issuePayload);

        expect(result).toBeNull();
      });
    });

    describe('pull_request', () => {
      const prPayload = {
        action: 'opened',
        pull_request: {
          number: 456,
          title: 'Test PR',
          body: 'PR body',
          html_url: 'https://github.com/test/repo/pull/456',
          user: { login: 'testuser' },
          merged: false,
          draft: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        repository: {
          full_name: 'test/repo',
          html_url: 'https://github.com/test/repo',
        },
        sender: {
          login: 'testuser',
        },
      };

      it('pull_requestイベントを処理してFactを作成できること', async () => {
        const result = await service.processGitHubEvent('pull_request', prPayload);

        expect(result).toEqual({ factId: 'fact-1' });
        expect(prisma.fact.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              source_externalId: {
                source: 'github',
                externalId: 'test/repo#456',
              },
            },
            create: expect.objectContaining({
              userId: 'user-123',
              source: 'github',
              type: 'pull_request.opened',
              title: '[test/repo] PR #456: Test PR',
            }),
          }),
        );
      });

      it('pull_requestペイロードがない場合はエラーをスローすること', async () => {
        const invalidPayload = {
          action: 'opened',
          repository: {
            full_name: 'test/repo',
            html_url: 'https://github.com/test/repo',
          },
          sender: {
            login: 'testuser',
          },
        };

        await expect(
          service.processGitHubEvent('pull_request', invalidPayload as any),
        ).rejects.toThrow('Pull Requestペイロードがありません');
      });
    });

    describe('push', () => {
      const pushPayload = {
        ref: 'refs/heads/main',
        commits: [
          {
            id: 'abc123def456',
            message: 'Fix bug\n\nDetailed description',
            url: 'https://github.com/test/repo/commit/abc123def456',
            author: { name: 'Test User', email: 'test@example.com' },
            timestamp: '2024-01-01T00:00:00Z',
          },
          {
            id: 'def456abc123',
            message: 'Add feature',
            url: 'https://github.com/test/repo/commit/def456abc123',
            author: { name: 'Test User', email: 'test@example.com' },
            timestamp: '2024-01-01T01:00:00Z',
          },
        ],
        repository: {
          full_name: 'test/repo',
          html_url: 'https://github.com/test/repo',
        },
        sender: {
          login: 'testuser',
        },
      };

      it('pushイベントを処理して複数のFactを作成できること', async () => {
        const mockFact2 = { ...mockFact, id: 'fact-2' };
        mockPrismaService.fact.upsert
          .mockResolvedValueOnce(mockFact)
          .mockResolvedValueOnce(mockFact2);

        const result = await service.processGitHubEvent('push', pushPayload);

        expect(result).toEqual({ factIds: ['fact-1', 'fact-2'] });
        expect(prisma.fact.upsert).toHaveBeenCalledTimes(2);
      });

      it('コミットが空の場合は空の配列を返すこと', async () => {
        const emptyPushPayload = {
          ...pushPayload,
          commits: [],
        };

        const result = await service.processGitHubEvent('push', emptyPushPayload);

        expect(result).toEqual({ factIds: [] });
      });
    });

    describe('ping', () => {
      const pingPayload = {
        repository: {
          full_name: 'test/repo',
          html_url: 'https://github.com/test/repo',
        },
        sender: {
          login: 'testuser',
        },
      };

      it('pingイベントはnullを返すこと', async () => {
        const result = await service.processGitHubEvent('ping', pingPayload);

        expect(result).toBeNull();
      });
    });

    describe('未対応イベント', () => {
      const unknownPayload = {
        repository: {
          full_name: 'test/repo',
          html_url: 'https://github.com/test/repo',
        },
        sender: {
          login: 'testuser',
        },
      };

      it('未対応のイベントタイプはnullを返すこと', async () => {
        const result = await service.processGitHubEvent('release', unknownPayload);

        expect(result).toBeNull();
      });
    });
  });

  describe('upsertFact', () => {
    const userId = 'user-123';
    const factData = {
      externalId: 'ext-123',
      source: 'github',
      sourceUrl: 'https://github.com/test',
      occurredAt: new Date('2024-01-01'),
      title: 'Test Title',
      summary: 'Test Summary',
      content: 'Test Content',
      type: 'test.type',
      metadata: { key: 'value' },
      raw: { original: 'data' },
    };

    it('Slackメッセージが未送信の場合はキューに追加すること', async () => {
      const mockFact = {
        id: 'fact-1',
        ...factData,
        userId,
        slackMessageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaService.fact.upsert.mockResolvedValue(mockFact);
      mockSlackQueue.add.mockResolvedValue({});

      // Use the service to trigger upsertFact indirectly through processGitHubEvent
      const mockIntegration = {
        id: 'int-1',
        userId,
        provider: 'github',
        accountId: 'gh-123',
        user: { id: userId },
      };
      mockPrismaService.integration.findMany.mockResolvedValue([mockIntegration]);

      const issuePayload = {
        action: 'opened',
        issue: {
          number: 123,
          title: 'Test',
          html_url: 'https://github.com/test/repo/issues/123',
          user: { login: 'testuser' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        repository: {
          full_name: 'test/repo',
          html_url: 'https://github.com/test/repo',
        },
        sender: { login: 'testuser' },
      };

      await service.processGitHubEvent('issues', issuePayload);

      expect(slackQueue.add).toHaveBeenCalledWith(
        'send-dm',
        { factId: 'fact-1' },
        {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      );
    });

    it('Slackメッセージが既に送信済みの場合はキューに追加しないこと', async () => {
      const mockFact = {
        id: 'fact-1',
        ...factData,
        userId,
        slackMessageId: 'slack-msg-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaService.fact.upsert.mockResolvedValue(mockFact);

      const mockIntegration = {
        id: 'int-1',
        userId,
        provider: 'github',
        accountId: 'gh-123',
        user: { id: userId },
      };
      mockPrismaService.integration.findMany.mockResolvedValue([mockIntegration]);

      const issuePayload = {
        action: 'opened',
        issue: {
          number: 123,
          title: 'Test',
          html_url: 'https://github.com/test/repo/issues/123',
          user: { login: 'testuser' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        repository: {
          full_name: 'test/repo',
          html_url: 'https://github.com/test/repo',
        },
        sender: { login: 'testuser' },
      };

      await service.processGitHubEvent('issues', issuePayload);

      expect(slackQueue.add).not.toHaveBeenCalled();
    });
  });
});
