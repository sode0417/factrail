import { scrubBrowserFact } from './history-scrubber';

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJl';

describe('scrubBrowserFact', () => {
  it('ログインの URL を落とし、ほかの URL のクエリと # の後ろを落とす', () => {
    const result = scrubBrowserFact('https://example.com/docs?token=secret#access_token=x', {
      domains: ['example.com', 'accounts.google.com'],
      visit_count: 3,
      duration_min: 5,
      search_queries: [],
      urls: [
        { url: 'https://accounts.google.com/o/oauth2/v2/auth?state=secret', title: 'ログイン' },
        { url: 'https://example.com/docs?token=secret#access_token=x', title: 'Docs' },
        { url: 'https://example.com/plain', title: 'Plain' },
      ],
    });

    expect(result.changed).toBe(true);
    expect(result.sourceUrl).toBe('https://example.com/docs');
    expect(result.metadata).toEqual({
      domains: ['example.com', 'accounts.google.com'],
      visit_count: 3,
      duration_min: 5,
      search_queries: [],
      urls: [
        { url: 'https://example.com/docs', title: 'Docs' },
        { url: 'https://example.com/plain', title: 'Plain' },
      ],
    });
    expect(result.stats).toEqual({
      urls: 3,
      urlsRemoved: 1,
      urlsRewritten: 1,
      searchQueriesRemoved: 0,
      sourceUrlChanged: true,
    });
  });

  it('検索語と YouTube の動画番号は残す', () => {
    const metadata = {
      search_queries: ['nestjs prisma transaction'],
      urls: [
        { url: 'https://www.google.com/search?q=nestjs+prisma+transaction', title: '検索' },
        { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: '動画' },
      ],
    };
    const result = scrubBrowserFact('https://www.youtube.com/watch?v=dQw4w9WgXcQ', metadata);

    expect(result.changed).toBe(false);
    expect(result.metadata).toBe(metadata);
    expect(result.sourceUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('鍵や URL が入った検索語は落とす', () => {
    const result = scrubBrowserFact(null, {
      search_queries: ['ok query', JWT, 'https://example.com/?code=secret'],
      urls: [],
    });

    expect(result.changed).toBe(true);
    expect((result.metadata as { search_queries: string[] }).search_queries).toEqual(['ok query']);
    expect(result.stats.searchQueriesRemoved).toBe(2);
    expect(result.sourceUrl).toBeNull();
  });

  it('主要 URL がログインの画面なら、残った URL から選び直す', () => {
    const result = scrubBrowserFact('https://example.com/login?next=/', {
      urls: [
        {
          url: 'https://example.com/login?next=/',
          title: 'ログインしてください、とても長いタイトル',
        },
        {
          url: 'https://www.google.com/search?q=abc',
          title: 'abc - Google 検索 の長い長いタイトル',
        },
        { url: 'https://example.com/a', title: 'A' },
        { url: 'https://example.com/bb', title: 'BB' },
      ],
    });

    expect(result.sourceUrl).toBe('https://example.com/bb');
  });

  it('URL が1つも残らなければ主要 URL は null', () => {
    const result = scrubBrowserFact(`https://example.com/callback?id_token=${JWT}`, {
      urls: [{ url: `https://example.com/callback?id_token=${JWT}`, title: '' }],
    });

    expect(result.sourceUrl).toBeNull();
    expect((result.metadata as { urls: unknown[] }).urls).toEqual([]);
  });

  it('形の分からない URL の項目は残さない', () => {
    const result = scrubBrowserFact(null, { urls: [{ title: 'no url' }, 'string', null] });

    expect((result.metadata as { urls: unknown[] }).urls).toEqual([]);
    expect(result.stats.urlsRemoved).toBe(3);
  });

  it('洗った結果をもう一度洗っても変わらない', () => {
    const first = scrubBrowserFact('https://example.com/x?token=secret', {
      search_queries: [JWT],
      urls: [{ url: 'https://example.com/x?token=secret', title: 'X' }],
    });
    const second = scrubBrowserFact(first.sourceUrl, first.metadata);

    expect(second.changed).toBe(false);
  });

  it('metadata が無い Fact は主要 URL だけ洗う', () => {
    const result = scrubBrowserFact('https://example.com/x#frag', null);

    expect(result.changed).toBe(true);
    expect(result.sourceUrl).toBe('https://example.com/x');
    expect(result.metadata).toBeNull();
  });
});
