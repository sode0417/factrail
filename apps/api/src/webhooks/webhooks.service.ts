import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { createHmac, timingSafeEqual } from 'crypto';
import { SettingsService } from '../settings/settings.service';
import { PrismaService } from '../prisma.service';
import { IntegrationsService } from '../integrations/integrations.service';
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
    private readonly integrationsService: IntegrationsService,
    @InjectQueue('slack-dispatch') private readonly slackQueue: Queue,
  ) {}

  /**
   * GitHub Webhook 署名を検証する
   */
  async verifyGitHubSignature(payload: string, signature: string | undefined): Promise<void> {
    if (!signature) {
      throw new UnauthorizedException('X-Hub-Signature-256 ヘッダーがありません');
    }

    const secret = await this.settingsService.getDecryptedValue('github', 'webhook_secret');

    if (!secret) {
      throw new UnauthorizedException(
        'GitHub Webhook シークレットが設定されていません。設定で構成してください。',
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
      throw new UnauthorizedException('Webhook署名が不正です');
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
      `GitHubイベントを処理中: ${eventType} (リポジトリ: ${payload.repository?.full_name})`,
    );

    switch (eventType) {
      case 'issues':
        return this.processIssueEvent(payload);
      case 'pull_request':
        return this.processPullRequestEvent(payload);
      case 'push':
        return this.processPushEvent(payload);
      case 'ping':
        this.logger.log('GitHubからpingイベントを受信しました');
        return null;
      default:
        this.logger.warn(`未対応のGitHubイベントタイプ: ${eventType}`);
        return null;
    }
  }

  /**
   * GitHubリポジトリに紐付くユーザーIDを取得する
   * リポジトリ名からowner (username/org) を抽出し、Integration.accountIdとマッチングする
   * Repositoryが登録されている場合、登録済みリポジトリのみ許可する
   */
  private async findUserIdForGitHubEvent(repository: string): Promise<string | null> {
    // リポジトリ名から所有者を抽出 (例: "sode0417/factrail" -> "sode0417")
    const owner = repository.split('/')[0];

    if (!owner) {
      this.logger.error(`無効なリポジトリ名形式です: ${repository}`);
      return null;
    }

    // GitHub accountId (username/org) でマッチング
    const integration = await this.prisma.integration.findFirst({
      where: {
        provider: 'github',
        accountId: owner,
      },
      include: {
        user: true,
        repositories: true,
      },
    });

    if (!integration) {
      this.logger.warn(
        `GitHub連携が見つかりません。Factを作成できません: ${repository} (所有者: ${owner})\n` +
          `ヒント: /auth/github にアクセスして、GitHubアカウント "${owner}" で認証を行ってください。`,
      );
      return null;
    }

    // リポジトリフィルタリング: Repositoryが1件以上登録されている場合のみフィルタ
    if (integration.repositories.length > 0) {
      const registered = integration.repositories.find(
        (r) => r.fullName === repository && r.status === 'active',
      );

      if (!registered) {
        this.logger.warn(`未登録のリポジトリからのイベントです。Factを作成しません: ${repository}`);
        return null;
      }

      // lastEventAt を更新
      await this.prisma.repository.update({
        where: { id: registered.id },
        data: { lastEventAt: new Date() },
      });
    }

    return integration.userId;
  }

  /**
   * グループIDを生成する
   */
  private buildGroupId(
    repo: string,
    type: 'issue' | 'pull_request' | 'push',
    identifier: string,
  ): string {
    return `github:${repo}:${type}:${identifier}`;
  }

  /**
   * 親 Fact を決定し、parentId を設定する
   * 同じ groupId で最も古い Fact（parentId が null）を親とする
   */
  private async assignParent(factId: string, groupId: string, source: string): Promise<void> {
    const parent = await this.prisma.fact.findFirst({
      where: {
        groupId,
        source,
        parentId: null,
        id: { not: factId },
      },
      orderBy: { occurredAt: 'asc' },
      select: { id: true },
    });

    if (parent) {
      await this.prisma.fact.update({
        where: { id: factId },
        data: { parentId: parent.id },
      });
    }
  }

  /**
   * Slack投稿キューにジョブを追加する
   * assignParent の後に呼び出すこと（parentId が確定した状態で投稿するため）
   */
  private async dispatchToSlack(factId: string): Promise<void> {
    const fact = await this.prisma.fact.findUnique({
      where: { id: factId },
      select: { slackMessageId: true },
    });
    if (fact && !fact.slackMessageId) {
      await this.slackQueue.add(
        'send-dm',
        { factId },
        {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      );
      this.logger.log(`Slack投稿キューにジョブを追加: Fact ID=${factId}`);
    }
  }

  /**
   * Issue イベントを処理
   */
  private async processIssueEvent(
    payload: GitHubWebhookPayload,
  ): Promise<{ factId: string } | null> {
    const { action, issue, repository } = payload;

    if (!issue) {
      throw new Error('Issueペイロードがありません');
    }

    // GitHubイベントに対応するユーザーIDを取得
    const userId = await this.findUserIdForGitHubEvent(repository.full_name);
    if (!userId) {
      this.logger.warn('ユーザーが見つからないため、Factを作成できません');
      return null;
    }

    const externalId = `${repository.full_name}#issue${issue.number}:${action}`;
    const groupId = this.buildGroupId(repository.full_name, 'issue', String(issue.number));
    const type = `issue.${action}`;
    const title = `[${repository.full_name}] Issue #${issue.number}: ${issue.title}`;
    const summary = this.truncate(issue.body || '', 200);

    const fact = await this.upsertFact(userId, {
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
      groupId,
      groupType: 'issue',
    });

    await this.assignParent(fact.id, groupId, 'github');
    await this.dispatchToSlack(fact.id);

    return { factId: fact.id };
  }

  /**
   * Pull Request イベントを処理
   */
  private async processPullRequestEvent(
    payload: GitHubWebhookPayload,
  ): Promise<{ factId: string } | null> {
    const { action, pull_request, repository } = payload;

    if (!pull_request) {
      throw new Error('Pull Requestペイロードがありません');
    }

    // GitHubイベントに対応するユーザーIDを取得
    const userId = await this.findUserIdForGitHubEvent(repository.full_name);
    if (!userId) {
      this.logger.warn('ユーザーが見つからないため、Factを作成できません');
      return null;
    }

    const externalId = `${repository.full_name}#pr${pull_request.number}:${action}`;
    const groupId = this.buildGroupId(
      repository.full_name,
      'pull_request',
      String(pull_request.number),
    );
    const type = `pull_request.${action}`;
    const title = `[${repository.full_name}] PR #${pull_request.number}: ${pull_request.title}`;
    const summary = this.truncate(pull_request.body || '', 200);

    const fact = await this.upsertFact(userId, {
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
      groupId,
      groupType: 'pull_request',
    });

    await this.assignParent(fact.id, groupId, 'github');
    await this.dispatchToSlack(fact.id);

    return { factId: fact.id };
  }

  /**
   * Push イベントを処理（複数コミット対応）
   */
  private async processPushEvent(payload: GitHubWebhookPayload): Promise<{ factIds: string[] }> {
    const { commits, repository, ref } = payload;

    if (!commits || commits.length === 0) {
      return { factIds: [] };
    }

    // GitHubイベントに対応するユーザーIDを取得
    const userId = await this.findUserIdForGitHubEvent(repository.full_name);
    if (!userId) {
      this.logger.warn('ユーザーが見つからないため、Factを作成できません');
      return { factIds: [] };
    }

    const branch = ref?.replace('refs/heads/', '') || 'unknown';
    const pushDate = commits[0]?.timestamp
      ? new Date(commits[0].timestamp).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const groupId = this.buildGroupId(repository.full_name, 'push', `${branch}:${pushDate}`);
    const factIds: string[] = [];

    for (const commit of commits) {
      const externalId = `${repository.full_name}@${commit.id.substring(0, 7)}`;
      const title = `[${repository.full_name}] ${commit.message.split('\n')[0]}`;
      const summary = this.truncate(commit.message, 200);

      const fact = await this.upsertFact(userId, {
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
        groupId,
        groupType: 'push',
      });

      await this.assignParent(fact.id, groupId, 'github');
      await this.dispatchToSlack(fact.id);
      factIds.push(fact.id);
    }

    return { factIds };
  }

  /**
   * Fact を作成または更新（同じ externalId があれば更新）
   * Slack投稿は呼び出し元で assignParent 後に dispatchToSlack を使うこと
   */
  private async upsertFact(
    userId: string,
    data: {
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
      groupId?: string;
      groupType?: string;
    },
  ) {
    const fact = await this.prisma.fact.upsert({
      where: {
        source_externalId: {
          source: data.source,
          externalId: data.externalId,
        },
      },
      create: {
        userId,
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
        groupId: data.groupId,
        groupType: data.groupType,
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
        groupId: data.groupId,
        groupType: data.groupType,
      },
    });

    return fact;
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
