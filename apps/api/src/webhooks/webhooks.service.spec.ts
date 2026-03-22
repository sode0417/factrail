import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, Logger } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { SettingsService } from '../settings/settings.service';
import { PrismaService } from '../prisma.service';
import { IntegrationsService } from '../integrations/integrations.service';
import * as crypto from 'crypto';

describe('WebhooksService', () => {
  let service: WebhooksService;

  const mockSettingsService = {
    getDecryptedValue: jest.fn(),
  };

  const mockPrismaService = {
    fact: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    integration: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    repository: {
      update: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockIntegrationsService = {};

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
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);

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

      const signature = `sha256=${crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex')}`;

      await expect(service.verifyGitHubSignature(payload, signature)).resolves.toBeUndefined();
    });

    it('署名ヘッダーがない場合はUnauthorizedExceptionをスローすること', async () => {
      await expect(service.verifyGitHubSignature(payload, undefined)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.verifyGitHubSignature(payload, undefined)).rejects.toThrow(
        'X-Hub-Signature-256 ヘッダーがありません',
      );
    });

    it('シークレットが設定されていない場合はUnauthorizedExceptionをスローすること', async () => {
      mockSettingsService.getDecryptedValue.mockResolvedValue(null);

      await expect(service.verifyGitHubSignature(payload, 'sha256=invalid')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.verifyGitHubSignature(payload, 'sha256=invalid')).rejects.toThrow(
        'GitHub Webhook シークレットが設定されていません',
      );
    });

    it('署名が不正な場合はUnauthorizedExceptionをスローすること', async () => {
      mockSettingsService.getDecryptedValue.mockResolvedValue(secret);

      const invalidSignature = 'sha256=invalid';

      await expect(service.verifyGitHubSignature(payload, invalidSignature)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.verifyGitHubSignature(payload, invalidSignature)).rejects.toThrow(
        'Webhook署名が不正です',
      );
    });
  });

  describe('processGitHubEvent', () => {
    const mockIntegration = {
      id: 'int-1',
      userId: 'user-123',
      provider: 'github',
      accountId: 'test',
      user: { id: 'user-123' },
      repositories: [],
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
      mockPrismaService.integration.findFirst.mockResolvedValue(mockIntegration);
      mockPrismaService.fact.upsert.mockResolvedValue(mockFact);
      mockPrismaService.fact.findFirst.mockResolvedValue(null); // assignParent: 親なし
      mockPrismaService.repository.findFirst.mockResolvedValue(null);
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
        expect(mockPrismaService.fact.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              source_externalId: {
                source: 'github',
                externalId: 'test/repo#issue123:opened',
              },
            },
            create: expect.objectContaining({
              userId: 'user-123',
              source: 'github',
              type: 'issue.opened',
              title: '[test/repo] Issue #123: Test Issue',
              groupId: 'github:test/repo:issue:123',
              groupType: 'issue',
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

        await expect(service.processGitHubEvent('issues', invalidPayload as any)).rejects.toThrow(
          'Issueペイロードがありません',
        );
      });

      it('GitHub連携が見つからない場合はnullを返すこと', async () => {
        mockPrismaService.integration.findFirst.mockResolvedValue(null);

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
        expect(mockPrismaService.fact.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              source_externalId: {
                source: 'github',
                externalId: 'test/repo#pr456:opened',
              },
            },
            create: expect.objectContaining({
              userId: 'user-123',
              source: 'github',
              type: 'pull_request.opened',
              title: '[test/repo] PR #456: Test PR',
              groupId: 'github:test/repo:pull_request:456',
              groupType: 'pull_request',
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
        expect(mockPrismaService.fact.upsert).toHaveBeenCalledTimes(2);
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

  describe('グループ割り当て', () => {
    const mockIntegration = {
      id: 'int-1',
      userId: 'user-123',
      provider: 'github',
      accountId: 'test',
      user: { id: 'user-123' },
      repositories: [],
    };

    const issuePayload = {
      action: 'closed',
      issue: {
        number: 10,
        title: 'Test',
        html_url: 'https://github.com/test/repo/issues/10',
        user: { login: 'testuser' },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      },
      repository: {
        full_name: 'test/repo',
        html_url: 'https://github.com/test/repo',
      },
      sender: { login: 'testuser' },
    };

    it('同じ groupId の既存 Fact がある場合、parentId を設定すること', async () => {
      const parentFact = { id: 'parent-fact-1' };
      const newFact = { id: 'new-fact-1', slackMessageId: null };

      mockPrismaService.integration.findFirst.mockResolvedValue(mockIntegration);
      mockPrismaService.fact.upsert.mockResolvedValue(newFact);
      mockPrismaService.fact.findFirst.mockResolvedValue(parentFact);
      mockPrismaService.fact.update.mockResolvedValue({});
      mockPrismaService.repository.findFirst.mockResolvedValue(null);

      await service.processGitHubEvent('issues', issuePayload);

      expect(mockPrismaService.fact.findFirst).toHaveBeenCalledWith({
        where: {
          groupId: 'github:test/repo:issue:10',
          source: 'github',
          parentId: null,
          id: { not: 'new-fact-1' },
        },
        orderBy: { occurredAt: 'asc' },
        select: { id: true },
      });
      expect(mockPrismaService.fact.update).toHaveBeenCalledWith({
        where: { id: 'new-fact-1' },
        data: { parentId: 'parent-fact-1' },
      });
    });

    it('同じ groupId の既存 Fact がない場合、自分が親になること（parentId を設定しない）', async () => {
      const newFact = { id: 'new-fact-1', slackMessageId: null };

      mockPrismaService.integration.findFirst.mockResolvedValue(mockIntegration);
      mockPrismaService.fact.upsert.mockResolvedValue(newFact);
      mockPrismaService.fact.findFirst.mockResolvedValue(null);
      mockPrismaService.repository.findFirst.mockResolvedValue(null);

      await service.processGitHubEvent('issues', issuePayload);

      // update は upsertFact 内の parentId 設定では呼ばれない
      expect(mockPrismaService.fact.update).not.toHaveBeenCalled();
    });

    it('push イベントでブランチと日付ベースの groupId が設定されること', async () => {
      const pushPayload = {
        ref: 'refs/heads/feature/test',
        commits: [
          {
            id: 'abc123def456',
            message: 'Fix bug',
            url: 'https://github.com/test/repo/commit/abc123def456',
            author: { name: 'Test', email: 'test@example.com' },
            timestamp: '2024-01-15T10:00:00Z',
          },
        ],
        repository: { full_name: 'test/repo', html_url: 'https://github.com/test/repo' },
        sender: { login: 'testuser' },
      };

      const newFact = { id: 'push-fact-1', slackMessageId: null };
      mockPrismaService.integration.findFirst.mockResolvedValue(mockIntegration);
      mockPrismaService.fact.upsert.mockResolvedValue(newFact);
      mockPrismaService.fact.findFirst.mockResolvedValue(null);
      mockPrismaService.repository.findFirst.mockResolvedValue(null);

      await service.processGitHubEvent('push', pushPayload);

      expect(mockPrismaService.fact.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            groupId: 'github:test/repo:push:feature/test:2024-01-15',
            groupType: 'push',
          }),
        }),
      );
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
  });

  describe('findUserIdForGitHubEvent (repository owner matching)', () => {
    it('リポジトリ所有者がGitHub連携のaccountIdと一致する場合、userIdを返すこと', async () => {
      const mockIntegration = {
        id: 'int-1',
        userId: 'user-123',
        provider: 'github',
        accountId: 'sode0417',
        user: { id: 'user-123' },
        repositories: [],
      };
      mockPrismaService.integration.findFirst.mockResolvedValue(mockIntegration);
      mockPrismaService.fact.upsert.mockResolvedValue({
        id: 'fact-1',
        userId: 'user-123',
        slackMessageId: null,
      });

      const issuePayload = {
        action: 'opened',
        issue: {
          number: 123,
          title: 'Test Issue',
          html_url: 'https://github.com/sode0417/factrail/issues/123',
          user: { login: 'testuser' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        repository: {
          full_name: 'sode0417/factrail',
          html_url: 'https://github.com/sode0417/factrail',
        },
        sender: { login: 'testuser' },
      };

      const result = await service.processGitHubEvent('issues', issuePayload);

      expect(result).toEqual({ factId: 'fact-1' });
      expect(mockPrismaService.integration.findFirst).toHaveBeenCalledWith({
        where: {
          provider: 'github',
          accountId: 'sode0417',
        },
        include: { user: true, repositories: true },
      });
    });

    it('リポジトリ所有者がGitHub連携のaccountIdと一致しない場合、nullを返すこと', async () => {
      mockPrismaService.integration.findFirst.mockResolvedValue(null);

      const issuePayload = {
        action: 'opened',
        issue: {
          number: 123,
          title: 'Test Issue',
          html_url: 'https://github.com/otheruser/repo/issues/123',
          user: { login: 'testuser' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        repository: {
          full_name: 'otheruser/repo',
          html_url: 'https://github.com/otheruser/repo',
        },
        sender: { login: 'testuser' },
      };

      const result = await service.processGitHubEvent('issues', issuePayload);

      expect(result).toBeNull();
      expect(mockPrismaService.integration.findFirst).toHaveBeenCalledWith({
        where: {
          provider: 'github',
          accountId: 'otheruser',
        },
        include: { user: true, repositories: true },
      });
    });

    it('組織リポジトリの場合、組織名でマッチングすること', async () => {
      const mockIntegration = {
        id: 'int-1',
        userId: 'user-123',
        provider: 'github',
        accountId: 'myorg',
        user: { id: 'user-123' },
        repositories: [],
      };
      mockPrismaService.integration.findFirst.mockResolvedValue(mockIntegration);
      mockPrismaService.fact.upsert.mockResolvedValue({
        id: 'fact-1',
        userId: 'user-123',
        slackMessageId: null,
      });

      const issuePayload = {
        action: 'opened',
        issue: {
          number: 123,
          title: 'Test Issue',
          html_url: 'https://github.com/myorg/project/issues/123',
          user: { login: 'testuser' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        repository: {
          full_name: 'myorg/project',
          html_url: 'https://github.com/myorg/project',
        },
        sender: { login: 'testuser' },
      };

      const result = await service.processGitHubEvent('issues', issuePayload);

      expect(result).toEqual({ factId: 'fact-1' });
      expect(mockPrismaService.integration.findFirst).toHaveBeenCalledWith({
        where: {
          provider: 'github',
          accountId: 'myorg',
        },
        include: { user: true, repositories: true },
      });
    });
  });

  describe('repository filtering', () => {
    const issuePayload = {
      action: 'opened',
      issue: {
        number: 1,
        title: 'Test Issue',
        html_url: 'https://github.com/test/repo/issues/1',
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

    it('Repository未登録時（0件）は全イベントを許可すること（後方互換）', async () => {
      const integrationNoRepos = {
        id: 'int-1',
        userId: 'user-123',
        provider: 'github',
        accountId: 'test',
        user: { id: 'user-123' },
        repositories: [],
      };
      mockPrismaService.integration.findFirst.mockResolvedValue(integrationNoRepos);
      mockPrismaService.fact.upsert.mockResolvedValue({
        id: 'fact-1',
        userId: 'user-123',
        slackMessageId: null,
      });

      const result = await service.processGitHubEvent('issues', issuePayload);

      expect(result).toEqual({ factId: 'fact-1' });
      expect(mockPrismaService.repository.update).not.toHaveBeenCalled();
    });

    it('登録済みリポジトリからのイベントを許可し、lastEventAtを更新すること', async () => {
      const integrationWithRepos = {
        id: 'int-1',
        userId: 'user-123',
        provider: 'github',
        accountId: 'test',
        user: { id: 'user-123' },
        repositories: [
          {
            id: 'repo-1',
            integrationId: 'int-1',
            fullName: 'test/repo',
            owner: 'test',
            name: 'repo',
            isPrivate: false,
            status: 'active',
            lastEventAt: null,
          },
        ],
      };
      mockPrismaService.integration.findFirst.mockResolvedValue(integrationWithRepos);
      mockPrismaService.fact.upsert.mockResolvedValue({
        id: 'fact-1',
        userId: 'user-123',
        slackMessageId: null,
      });
      mockPrismaService.repository.update.mockResolvedValue({});

      const result = await service.processGitHubEvent('issues', issuePayload);

      expect(result).toEqual({ factId: 'fact-1' });
      expect(mockPrismaService.repository.update).toHaveBeenCalledWith({
        where: { id: 'repo-1' },
        data: { lastEventAt: expect.any(Date) },
      });
    });

    it('未登録リポジトリからのイベントを拒否すること', async () => {
      const integrationWithOtherRepos = {
        id: 'int-1',
        userId: 'user-123',
        provider: 'github',
        accountId: 'test',
        user: { id: 'user-123' },
        repositories: [
          {
            id: 'repo-1',
            integrationId: 'int-1',
            fullName: 'test/other-repo',
            owner: 'test',
            name: 'other-repo',
            isPrivate: false,
            status: 'active',
            lastEventAt: null,
          },
        ],
      };
      mockPrismaService.integration.findFirst.mockResolvedValue(integrationWithOtherRepos);

      const result = await service.processGitHubEvent('issues', issuePayload);

      expect(result).toBeNull();
      expect(mockPrismaService.fact.upsert).not.toHaveBeenCalled();
    });

    it('inactiveリポジトリからのイベントを拒否すること', async () => {
      const integrationWithInactiveRepo = {
        id: 'int-1',
        userId: 'user-123',
        provider: 'github',
        accountId: 'test',
        user: { id: 'user-123' },
        repositories: [
          {
            id: 'repo-1',
            integrationId: 'int-1',
            fullName: 'test/repo',
            owner: 'test',
            name: 'repo',
            isPrivate: false,
            status: 'inactive',
            lastEventAt: null,
          },
        ],
      };
      mockPrismaService.integration.findFirst.mockResolvedValue(integrationWithInactiveRepo);

      const result = await service.processGitHubEvent('issues', issuePayload);

      expect(result).toBeNull();
      expect(mockPrismaService.fact.upsert).not.toHaveBeenCalled();
    });
  });
});
