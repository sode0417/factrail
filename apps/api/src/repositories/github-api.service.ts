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
}
