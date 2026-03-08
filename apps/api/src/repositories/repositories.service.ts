import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { SettingsService } from '../settings/settings.service';
import { GitHubApiService, GitHubRepoInfo } from './github-api.service';

@Injectable()
export class RepositoriesService {
  private readonly logger = new Logger(RepositoriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationsService: IntegrationsService,
    private readonly githubApiService: GitHubApiService,
    private readonly settingsService: SettingsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * ユーザーのGitHub Integrationを取得する
   */
  private async getGitHubIntegration(userId: string) {
    const integrations = await this.integrationsService.findByProvider(userId, 'github');
    if (integrations.length === 0) {
      throw new NotFoundException('GitHub連携が見つかりません');
    }
    return integrations[0];
  }

  /**
   * 登録済みリポジトリ一覧を取得する
   */
  async findAll(userId: string) {
    const integration = await this.getGitHubIntegration(userId);

    return this.prisma.repository.findMany({
      where: { integrationId: integration.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * GitHub APIからリポジトリ候補を取得する
   */
  async getAvailableRepositories(userId: string): Promise<GitHubRepoInfo[]> {
    const integration = await this.getGitHubIntegration(userId);
    return this.githubApiService.listRepositories(integration.accessToken);
  }

  /**
   * リポジトリを追加する
   */
  async add(userId: string, fullName: string) {
    const integration = await this.getGitHubIntegration(userId);

    // GitHub APIでリポジトリ情報を取得
    const repoInfo = await this.githubApiService.getRepository(integration.accessToken, fullName);
    if (!repoInfo) {
      throw new NotFoundException(`リポジトリが見つかりません: ${fullName}`);
    }

    // 重複チェック
    const existing = await this.prisma.repository.findUnique({
      where: {
        integrationId_fullName: {
          integrationId: integration.id,
          fullName: repoInfo.fullName,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(`リポジトリは既に登録されています: ${fullName}`);
    }

    // GitHub Webhookを自動作成
    let webhookId: number | null = null;
    try {
      const webhookConfig = await this.buildWebhookConfig();
      if (webhookConfig) {
        webhookId = await this.githubApiService.createWebhook(
          integration.accessToken,
          repoInfo.fullName,
          webhookConfig,
        );
      } else {
        this.logger.warn('Webhook設定が不完全なため、Webhook自動作成をスキップしました');
      }
    } catch (error) {
      this.logger.warn(
        `Webhook自動作成に失敗しました（手動設定が必要です）: ${fullName}`,
        error instanceof Error ? error.message : error,
      );
    }

    return this.prisma.repository.create({
      data: {
        integrationId: integration.id,
        fullName: repoInfo.fullName,
        owner: repoInfo.owner,
        name: repoInfo.name,
        isPrivate: repoInfo.isPrivate,
        webhookId,
      },
    });
  }

  /**
   * リポジトリを削除する
   */
  async remove(userId: string, id: string) {
    const integration = await this.getGitHubIntegration(userId);

    const repository = await this.prisma.repository.findFirst({
      where: {
        id,
        integrationId: integration.id,
      },
    });

    if (!repository) {
      throw new NotFoundException(`リポジトリが見つかりません: ID ${id}`);
    }

    // GitHub Webhookを自動削除
    if (repository.webhookId) {
      try {
        await this.githubApiService.deleteWebhook(
          integration.accessToken,
          repository.fullName,
          repository.webhookId,
        );
      } catch (error) {
        this.logger.warn(
          `Webhook自動削除に失敗しました（手動削除が必要です）: ${repository.fullName}`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    await this.prisma.repository.delete({
      where: { id },
    });
  }

  /**
   * 既存Factsからリポジトリを自動検出して登録する
   */
  async detectFromFacts(userId: string) {
    const integration = await this.getGitHubIntegration(userId);

    // GitHubソースのFactsからユニークなリポジトリ名を取得
    const facts = await this.prisma.fact.findMany({
      where: {
        userId,
        source: 'github',
      },
      select: {
        metadata: true,
      },
    });

    const repoNames = new Set<string>();
    for (const fact of facts) {
      const metadata = fact.metadata as Record<string, unknown> | null;
      if (metadata?.repository && typeof metadata.repository === 'string') {
        repoNames.add(metadata.repository);
      }
    }

    const added: string[] = [];

    for (const fullName of repoNames) {
      // 既に登録済みかチェック
      const existing = await this.prisma.repository.findUnique({
        where: {
          integrationId_fullName: {
            integrationId: integration.id,
            fullName,
          },
        },
      });

      if (existing) {
        continue;
      }

      const [owner, name] = fullName.split('/');
      if (!owner || !name) {
        continue;
      }

      // GitHub APIでリポジトリ情報を取得（存在しない場合はスキップ）
      try {
        const repoInfo = await this.githubApiService.getRepository(
          integration.accessToken,
          fullName,
        );

        await this.prisma.repository.create({
          data: {
            integrationId: integration.id,
            fullName,
            owner: repoInfo?.owner || owner,
            name: repoInfo?.name || name,
            isPrivate: repoInfo?.isPrivate || false,
          },
        });

        added.push(fullName);
      } catch (error) {
        this.logger.warn(`リポジトリ情報の取得に失敗しました: ${fullName}`, error);
        // API取得に失敗してもFact情報から登録
        await this.prisma.repository.create({
          data: {
            integrationId: integration.id,
            fullName,
            owner,
            name,
            isPrivate: false,
          },
        });
        added.push(fullName);
      }
    }

    return { added };
  }

  /**
   * Webhook設定を構築する
   */
  private async buildWebhookConfig() {
    const apiUrl = this.configService.get<string>('API_URL');
    const webhookSecret = await this.settingsService.getDecryptedValue('github', 'webhook_secret');

    if (!apiUrl || !webhookSecret) {
      return null;
    }

    return {
      url: `${apiUrl}/webhooks/github`,
      secret: webhookSecret,
      events: ['issues', 'pull_request', 'push'],
    };
  }
}
