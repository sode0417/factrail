import { Injectable, Logger } from '@nestjs/common';

interface GitHubRepo {
  full_name: string;
  name: string;
  owner: { login: string };
  private: boolean;
  html_url: string;
}

export interface GitHubRepoInfo {
  fullName: string;
  name: string;
  owner: string;
  isPrivate: boolean;
  htmlUrl: string;
}

interface GitHubWebhookResponse {
  id: number;
  active: boolean;
  config: {
    url: string;
    content_type: string;
  };
  events: string[];
}

export interface WebhookConfig {
  url: string;
  secret: string;
  events: string[];
}

@Injectable()
export class GitHubApiService {
  private readonly logger = new Logger(GitHubApiService.name);

  async listRepositories(accessToken: string): Promise<GitHubRepoInfo[]> {
    const repos: GitHubRepoInfo[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await fetch(
        `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated&direction=desc`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
          },
        },
      );

      if (!response.ok) {
        this.logger.error(`GitHub API error: ${response.status} ${response.statusText}`);
        throw new Error(`GitHub APIリクエストに失敗しました: ${response.status}`);
      }

      const data: GitHubRepo[] = await response.json();

      for (const repo of data) {
        repos.push({
          fullName: repo.full_name,
          name: repo.name,
          owner: repo.owner.login,
          isPrivate: repo.private,
          htmlUrl: repo.html_url,
        });
      }

      if (data.length < perPage) {
        break;
      }

      page++;
    }

    return repos;
  }

  async getRepository(accessToken: string, fullName: string): Promise<GitHubRepoInfo | null> {
    const response = await fetch(`https://api.github.com/repos/${fullName}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      this.logger.error(`GitHub API error: ${response.status} ${response.statusText}`);
      throw new Error(`GitHub APIリクエストに失敗しました: ${response.status}`);
    }

    const repo: GitHubRepo = await response.json();

    return {
      fullName: repo.full_name,
      name: repo.name,
      owner: repo.owner.login,
      isPrivate: repo.private,
      htmlUrl: repo.html_url,
    };
  }

  /**
   * リポジトリにWebhookを作成する
   */
  async createWebhook(
    accessToken: string,
    fullName: string,
    config: WebhookConfig,
  ): Promise<number> {
    const response = await fetch(`https://api.github.com/repos/${fullName}/hooks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: config.events,
        config: {
          url: config.url,
          content_type: 'json',
          secret: config.secret,
          insecure_ssl: '0',
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Webhook作成に失敗: ${response.status} ${body}`);
      throw new Error(`Webhook作成に失敗しました: ${response.status}`);
    }

    const webhook: GitHubWebhookResponse = await response.json();
    this.logger.log(`Webhook作成成功: ${fullName} (ID: ${webhook.id})`);
    return webhook.id;
  }

  /**
   * リポジトリのWebhookを削除する
   */
  async deleteWebhook(accessToken: string, fullName: string, webhookId: number): Promise<void> {
    const response = await fetch(`https://api.github.com/repos/${fullName}/hooks/${webhookId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (response.status === 404) {
      this.logger.warn(`Webhookが見つかりません: ${fullName} (ID: ${webhookId})`);
      return;
    }

    if (!response.ok) {
      this.logger.error(`Webhook削除に失敗: ${response.status}`);
      throw new Error(`Webhook削除に失敗しました: ${response.status}`);
    }

    this.logger.log(`Webhook削除成功: ${fullName} (ID: ${webhookId})`);
  }
}
