import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let service: WebhooksService;

  const mockWebhooksService = {
    verifyGitHubSignature: jest.fn(),
    processGitHubEvent: jest.fn(),
  };

  const mockRequest = {
    body: {},
    headers: {},
    rawBody: '{"test":"payload"}',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        {
          provide: WebhooksService,
          useValue: mockWebhooksService,
        },
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
    service = module.get<WebhooksService>(WebhooksService);

    // Disable logging during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleGitHubWebhook', () => {
    const signature = 'sha256=abc123';
    const eventType = 'issues';
    const deliveryId = 'delivery-123';

    const issuePayload = {
      action: 'opened',
      issue: {
        number: 123,
        title: 'Test Issue',
        body: 'Issue body',
        html_url: 'https://github.com/test/repo/issues/123',
        user: { login: 'testuser' },
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

    beforeEach(() => {
      mockWebhooksService.verifyGitHubSignature.mockResolvedValue(undefined);
    });

    it('GitHub webhookを受信して処理できること', async () => {
      mockWebhooksService.processGitHubEvent.mockResolvedValue({ factId: 'fact-1' });

      const result = await controller.handleGitHubWebhook(
        signature,
        eventType,
        deliveryId,
        mockRequest as any,
        issuePayload,
      );

      expect(result).toEqual({ success: true, factId: 'fact-1' });
      expect(service.verifyGitHubSignature).toHaveBeenCalledWith(mockRequest.rawBody, signature);
      expect(service.processGitHubEvent).toHaveBeenCalledWith(eventType, issuePayload);
    });

    it('署名検証が実行されること', async () => {
      mockWebhooksService.processGitHubEvent.mockResolvedValue({ factId: 'fact-1' });

      await controller.handleGitHubWebhook(
        signature,
        eventType,
        deliveryId,
        mockRequest as any,
        issuePayload,
      );

      expect(service.verifyGitHubSignature).toHaveBeenCalledWith(mockRequest.rawBody, signature);
    });

    it('イベントタイプがない場合はメッセージを返すこと', async () => {
      const result = await controller.handleGitHubWebhook(
        signature,
        undefined,
        deliveryId,
        mockRequest as any,
        issuePayload,
      );

      expect(result).toEqual({ success: true, message: 'No event type specified' });
      expect(service.processGitHubEvent).not.toHaveBeenCalled();
    });

    it('processGitHubEventがnullを返す場合は確認メッセージを返すこと', async () => {
      mockWebhooksService.processGitHubEvent.mockResolvedValue(null);

      const result = await controller.handleGitHubWebhook(
        signature,
        'ping',
        deliveryId,
        mockRequest as any,
        issuePayload,
      );

      expect(result).toEqual({ success: true, message: 'Event ping acknowledged' });
    });

    it('pull_requestイベントを処理できること', async () => {
      const prPayload = {
        action: 'opened',
        pull_request: {
          number: 456,
          title: 'Test PR',
          body: 'PR body',
          html_url: 'https://github.com/test/repo/pull/456',
          user: { login: 'testuser' },
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
      mockWebhooksService.processGitHubEvent.mockResolvedValue({ factId: 'fact-2' });

      const result = await controller.handleGitHubWebhook(
        signature,
        'pull_request',
        deliveryId,
        mockRequest as any,
        prPayload,
      );

      expect(result).toEqual({ success: true, factId: 'fact-2' });
      expect(service.processGitHubEvent).toHaveBeenCalledWith('pull_request', prPayload);
    });

    it('pushイベントを処理できること', async () => {
      const pushPayload = {
        ref: 'refs/heads/main',
        commits: [
          {
            id: 'abc123',
            message: 'Fix bug',
            url: 'https://github.com/test/repo/commit/abc123',
            author: { name: 'Test User', email: 'test@example.com' },
            timestamp: '2024-01-01T00:00:00Z',
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
      mockWebhooksService.processGitHubEvent.mockResolvedValue({ factIds: ['fact-3'] });

      const result = await controller.handleGitHubWebhook(
        signature,
        'push',
        deliveryId,
        mockRequest as any,
        pushPayload,
      );

      expect(result).toEqual({ success: true, factIds: ['fact-3'] });
      expect(service.processGitHubEvent).toHaveBeenCalledWith('push', pushPayload);
    });

    it('署名がundefinedの場合も検証を試みること', async () => {
      mockWebhooksService.processGitHubEvent.mockResolvedValue({ factId: 'fact-1' });

      await controller.handleGitHubWebhook(
        undefined,
        eventType,
        deliveryId,
        mockRequest as any,
        issuePayload,
      );

      expect(service.verifyGitHubSignature).toHaveBeenCalledWith(mockRequest.rawBody, undefined);
    });
  });
});
