import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { GitHubApiService } from './github-api.service';

describe('GitHubApiService', () => {
  let service: GitHubApiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GitHubApiService],
    }).compile();

    service = module.get<GitHubApiService>(GitHubApiService);

    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('listRepositories', () => {
    it('GitHub APIからリポジトリ一覧を取得できること', async () => {
      const mockRepos = [
        {
          full_name: 'test/repo1',
          name: 'repo1',
          owner: { login: 'test' },
          private: false,
          html_url: 'https://github.com/test/repo1',
        },
        {
          full_name: 'test/repo2',
          name: 'repo2',
          owner: { login: 'test' },
          private: true,
          html_url: 'https://github.com/test/repo2',
        },
      ];

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepos,
      } as Response);

      const result = await service.listRepositories('test-token');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        fullName: 'test/repo1',
        name: 'repo1',
        owner: 'test',
        isPrivate: false,
        htmlUrl: 'https://github.com/test/repo1',
      });
      expect(result[1].isPrivate).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.github.com/user/repos'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        }),
      );
    });

    it('APIエラー時に例外をスローすること', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      } as Response);

      await expect(service.listRepositories('invalid-token')).rejects.toThrow(
        'GitHub APIリクエストに失敗しました: 401',
      );
    });
  });

  describe('getRepository', () => {
    it('リポジトリ情報を取得できること', async () => {
      const mockRepo = {
        full_name: 'test/repo1',
        name: 'repo1',
        owner: { login: 'test' },
        private: false,
        html_url: 'https://github.com/test/repo1',
      };

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockRepo,
      } as Response);

      const result = await service.getRepository('test-token', 'test/repo1');

      expect(result).toEqual({
        fullName: 'test/repo1',
        name: 'repo1',
        owner: 'test',
        isPrivate: false,
        htmlUrl: 'https://github.com/test/repo1',
      });
    });

    it('リポジトリが存在しない場合はnullを返すこと', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const result = await service.getRepository('test-token', 'test/nonexistent');

      expect(result).toBeNull();
    });

    it('APIエラー時に例外をスローすること', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(service.getRepository('test-token', 'test/repo1')).rejects.toThrow(
        'GitHub APIリクエストに失敗しました: 500',
      );
    });
  });
});
