import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { SettingsService } from '../settings/settings.service';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

/**
 * GitHub Webhook イベントペイロードの型定義
 */
interface GitHubWebhookPayload {
  action?: string;
  issue?: {
    number: number;
    title: string;
    body?: string;
    html_url: string;
    user: { login: string };
    labels?: Array<{ name: string }>;
    created_at: string;
    updated_at: string;
  };
  pull_request?: {
    number: number;
    title: string;
    body?: string;
    html_url: string;
    user: { login: string };
    merged?: boolean;
    draft?: boolean;
    created_at: string;
    updated_at: string;
  };
  commits?: Array<{
    id: string;
    message: string;
    url: string;
    author: { name: string; email: string };
    timestamp: string;
  }>;
  ref?: string;
  repository: {
    full_name: string;
    html_url: string;
  };
  sender: {
    login: string;
  };
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GitHub Webhook 署名を検証する
   */
  async verifyGitHubSignature(
    payload: string,
    signature: string | undefined,
  ): Promise<void> {
    if (!signature) {
      throw new UnauthorizedException('Missing X-Hub-Signature-256 header');
    }

    const secret = await this.settingsService.getDecryptedValue(
      'github',
      'webhook_secret',
    );

    if (!secret) {
      throw new UnauthorizedException(
        'GitHub webhook secret not configured. Please configure it in Settings.',
      );
    }

    const expectedSignature = `sha256=${createHmac('sha256', secret)
      .update(payload)
      .digest('hex')}`;

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  /**
   * GitHub Webhook イベントを処理して Fact を作成する
   */
  async processGitHubEvent(
    eventType: string,
    payload: GitHubWebhookPayload,
  ): Promise<{ factId: string } | { factIds: string[] } | null> {
    this.logger.log(
      `Processing GitHub event: ${eventType} for ${payload.repository?.full_name}`,
    );

    switch (eventType) {
      case 'issues':
        return this.processIssueEvent(payload);
      case 'pull_request':
        return this.processPullRequestEvent(payload);
      case 'push':
        return this.processPushEvent(payload);
      case 'ping':
        this.logger.log('Received ping event from GitHub');
        return null;
      default:
        this.logger.warn(`Unhandled GitHub event type: ${eventType}`);
        return null;
    }
  }

  /**
   * Issue イベントを処理
   */
  private async processIssueEvent(
    payload: GitHubWebhookPayload,
  ): Promise<{ factId: string }> {
    const { action, issue, repository } = payload;

    if (!issue) {
      throw new Error('Issue payload is missing');
    }

    const externalId = `${repository.full_name}#${issue.number}`;
    const type = `issue.${action}`;
    const title = `[${repository.full_name}] Issue #${issue.number}: ${issue.title}`;
    const summary = this.truncate(issue.body || '', 200);

    const fact = await this.upsertFact({
      externalId,
      source: 'github',
      sourceUrl: issue.html_url,
      occurredAt: new Date(issue.updated_at || issue.created_at),
      title,
      summary,
      content: issue.body,
      type,
      metadata: {
        action,
        repository: repository.full_name,
        number: issue.number,
        author: issue.user.login,
        labels: issue.labels?.map((l) => l.name) || [],
      },
      raw: payload,
    });

    return { factId: fact.id };
  }

  /**
   * Pull Request イベントを処理
   */
  private async processPullRequestEvent(
    payload: GitHubWebhookPayload,
  ): Promise<{ factId: string }> {
    const { action, pull_request, repository } = payload;

    if (!pull_request) {
      throw new Error('Pull request payload is missing');
    }

    const externalId = `${repository.full_name}#${pull_request.number}`;
    const type = `pull_request.${action}`;
    const title = `[${repository.full_name}] PR #${pull_request.number}: ${pull_request.title}`;
    const summary = this.truncate(pull_request.body || '', 200);

    const fact = await this.upsertFact({
      externalId,
      source: 'github',
      sourceUrl: pull_request.html_url,
      occurredAt: new Date(pull_request.updated_at || pull_request.created_at),
      title,
      summary,
      content: pull_request.body,
      type,
      metadata: {
        action,
        repository: repository.full_name,
        number: pull_request.number,
        author: pull_request.user.login,
        merged: pull_request.merged,
        draft: pull_request.draft,
      },
      raw: payload,
    });

    return { factId: fact.id };
  }

  /**
   * Push イベントを処理（複数コミット対応）
   */
  private async processPushEvent(
    payload: GitHubWebhookPayload,
  ): Promise<{ factIds: string[] }> {
    const { commits, repository, ref } = payload;

    if (!commits || commits.length === 0) {
      return { factIds: [] };
    }

    const branch = ref?.replace('refs/heads/', '') || 'unknown';
    const factIds: string[] = [];

    for (const commit of commits) {
      const externalId = `${repository.full_name}@${commit.id.substring(0, 7)}`;
      const title = `[${repository.full_name}] ${commit.message.split('\n')[0]}`;
      const summary = this.truncate(commit.message, 200);

      const fact = await this.upsertFact({
        externalId,
        source: 'github',
        sourceUrl: commit.url,
        occurredAt: new Date(commit.timestamp),
        title,
        summary,
        content: commit.message,
        type: 'push.commit',
        metadata: {
          repository: repository.full_name,
          branch,
          sha: commit.id,
          author: commit.author.name,
          authorEmail: commit.author.email,
        },
        raw: commit,
      });

      factIds.push(fact.id);
    }

    return { factIds };
  }

  /**
   * Fact を作成または更新（同じ externalId があれば更新）
   */
  private async upsertFact(data: {
    externalId: string;
    source: string;
    sourceUrl: string;
    occurredAt: Date;
    title: string;
    summary: string | null;
    content: string | null | undefined;
    type: string;
    metadata: Record<string, unknown>;
    raw: unknown;
  }) {
    return this.prisma.fact.upsert({
      where: {
        source_externalId: {
          source: data.source,
          externalId: data.externalId,
        },
      },
      create: {
        externalId: data.externalId,
        source: data.source,
        sourceUrl: data.sourceUrl,
        occurredAt: data.occurredAt,
        title: data.title,
        summary: data.summary,
        content: data.content,
        type: data.type,
        metadata: data.metadata as Prisma.InputJsonValue,
        raw: data.raw as Prisma.InputJsonValue,
        processedAt: new Date(),
      },
      update: {
        sourceUrl: data.sourceUrl,
        occurredAt: data.occurredAt,
        title: data.title,
        summary: data.summary,
        content: data.content,
        type: data.type,
        metadata: data.metadata as Prisma.InputJsonValue,
        raw: data.raw as Prisma.InputJsonValue,
        processedAt: new Date(),
      },
    });
  }

  /**
   * 文字列を指定の長さに切り詰める
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }
}
