import { REDACTED, scrubBrowserFact, BrowserFactFields } from './history-scrubber';
import { sanitizeVisitUrl } from './url-sanitizer';

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJl';

function fact(partial: Partial<BrowserFactFields>): BrowserFactFields {
  return { sourceUrl: null, title: '題名', summary: '要約', metadata: null, ...partial };
}

describe('scrubBrowserFact', () => {
  it('ログインの URL を落とし、ほかの URL のクエリと # の後ろを落とす', () => {
    const result = scrubBrowserFact(
      fact({
        sourceUrl: 'https://example.com/docs?token=secret#access_token=x',
        metadata: {
          domains: ['accounts.google.com', 'example.com'],
          visit_count: 3,
          duration_min: 5,
          search_queries: [],
          urls: [
            { url: 'https://accounts.google.com/o/oauth2/v2/auth?state=secret', title: 'ログイン' },
            { url: 'https://example.com/docs?token=secret#access_token=x', title: 'Docs' },
            { url: 'https://example.com/plain', title: 'Plain' },
          ],
        },
      }),
    );

    expect(result.changed).toBe(true);
    expect(result.sourceUrl).toBe('https://example.com/docs');
    expect(result.metadata).toEqual({
      domains: ['example.com'],
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
      domainsRemoved: 1,
      visitTitlesRedacted: 0,
      sourceUrlChanged: true,
      textRedacted: false,
    });
  });

  it('検索語と YouTube の動画番号は残す（何も変えない）', () => {
    const input = fact({
      sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'nestjs prisma transaction を調査',
      metadata: {
        domains: ['www.google.com', 'www.youtube.com'],
        search_queries: ['nestjs prisma transaction'],
        urls: [
          { url: 'https://www.google.com/search?q=nestjs+prisma+transaction', title: '検索' },
          { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: '動画' },
        ],
      },
    });
    const result = scrubBrowserFact(input);

    expect(result.changed).toBe(false);
    expect(result.metadata).toBe(input.metadata);
    expect(result.title).toBe(input.title);
  });

  it('鍵の入った検索語は落とし、題名と要約からも伏せる', () => {
    const result = scrubBrowserFact(
      fact({
        title: `${JWT} を調査`,
        summary: `検索クエリ: ${JWT}, ok query（1サイト訪問）`,
        metadata: {
          search_queries: [JWT, 'ok query'],
          urls: [
            { url: `https://www.google.com/search?q=${JWT}`, title: '' },
            { url: 'https://www.google.com/search?q=ok+query', title: '' },
          ],
        },
      }),
    );

    const metadata = result.metadata as { search_queries: string[] };
    expect(metadata.search_queries).toEqual(['ok query']);
    expect(result.title).toBe(`${REDACTED} を調査`);
    expect(result.summary).toBe(`検索クエリ: ${REDACTED}, ok query（1サイト訪問）`);
    expect(result.stats.textRedacted).toBe(true);
  });

  it('検索の結果の画面の題名に入った、落とした検索語も伏せる', () => {
    const result = scrubBrowserFact(
      fact({
        metadata: {
          search_queries: [JWT],
          urls: [{ url: `https://www.google.com/search?q=${JWT}`, title: `${JWT} - Google 検索` }],
        },
      }),
    );

    const metadata = result.metadata as { urls: Array<{ url: string; title: string }> };
    expect(metadata.urls).toEqual([
      { url: 'https://www.google.com/search', title: `${REDACTED} - Google 検索` },
    ]);
    expect(result.stats.visitTitlesRedacted).toBe(1);
  });

  it('検索の結果の画面以外の q（地図の住所など）は検索語から外すが、題名は壊さない', () => {
    const result = scrubBrowserFact(
      fact({
        title: '東京都千代田区1-1 を調査',
        metadata: {
          search_queries: ['東京都千代田区1-1', 'the'],
          urls: [
            { url: 'https://maps.google.com/?q=東京都千代田区1-1', title: '地図' },
            { url: 'https://maps.google.com/?q=the', title: 'theory of react' },
          ],
        },
      }),
    );

    expect((result.metadata as { search_queries: string[] }).search_queries).toEqual([]);
    expect(result.title).toBe('東京都千代田区1-1 を調査');
    expect((result.metadata as { urls: Array<{ title: string }> }).urls[1].title).toBe(
      'theory of react',
    );
    expect(result.stats.textRedacted).toBe(false);
  });

  it('大文字小文字や前後の空白が違っても、鍵の形の検索語を伏せる', () => {
    const key = 'sk-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const result = scrubBrowserFact(
      fact({
        title: `${key.toLowerCase()} を調査`,
        summary: `検索クエリ: ${key}`,
        metadata: {
          search_queries: [` ${key} `],
          urls: [
            { url: `https://www.google.com/search?q=${key}`, title: `${key} - Google 検索` },
            {
              url: `https://www.google.com/search?q=${key.toLowerCase()}`,
              title: `${key.toLowerCase()} - Google 検索`,
            },
          ],
        },
      }),
    );

    const metadata = result.metadata as { urls: Array<{ title: string }> };
    expect(result.title).toBe(`${REDACTED} を調査`);
    expect(result.summary).toBe(`検索クエリ: ${REDACTED}`);
    expect(metadata.urls.map((u) => u.title)).toEqual([
      `${REDACTED} - Google 検索`,
      `${REDACTED} - Google 検索`,
    ]);
  });

  it('途中で切れた鍵や、google.com/url の q に入った鍵も伏せる', () => {
    const result = scrubBrowserFact(
      fact({
        title: '題名',
        summary: '鍵の一部 ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012 が見えた',
        metadata: {
          urls: [
            {
              url: 'https://www.google.com/url?q=https://example.com/cb?code=secret12345',
              title: 'https://example.com/cb?code=secret12345',
            },
          ],
        },
      }),
    );

    expect(result.summary).toBe(`鍵の一部 ${REDACTED} が見えた`);
    expect((result.metadata as { urls: Array<{ title: string }> }).urls[0].title).toBe(REDACTED);
  });

  it('ふつうの長い技術用語は伏せない', () => {
    const title = 'spring-boot-starter-data-jpa の設定と github.com/sode0417/factrail/pull/262';
    const result = scrubBrowserFact(fact({ title }));
    expect(result.title).toBe(title);
  });

  it('URL の一覧が無い古い形でも、鍵の形の検索語は落とす', () => {
    const result = scrubBrowserFact(fact({ metadata: { search_queries: ['ok', JWT, 42] } }));

    expect((result.metadata as { search_queries: unknown[] }).search_queries).toEqual(['ok']);
    expect(result.stats.searchQueriesRemoved).toBe(2);
  });

  it('主要 URL がログインの画面なら、残った URL から取り込みと同じ選び方で選び直す', () => {
    const result = scrubBrowserFact(
      fact({
        sourceUrl: 'https://example.com/login?next=/',
        metadata: {
          urls: [
            {
              url: 'https://example.com/login?next=/',
              title: 'ログインしてください、とても長い題名',
            },
            {
              url: 'https://www.google.com/search?q=abc',
              title: 'abc - Google 検索 のとても長い題名',
            },
            { url: 'https://www.google.com/maps/place/x', title: 'Google マップ の場所' },
            { url: 'https://example.com/bb', title: 'BB' },
          ],
        },
      }),
    );

    // q の無い google.com/maps は検索ではないので候補に入る（findPrimaryUrl と同じ）
    expect(result.sourceUrl).toBe('https://www.google.com/maps/place/x');
  });

  it('主要 URL が洗われて残るときは、urls に無くてもその URL を使う', () => {
    const result = scrubBrowserFact(
      fact({ sourceUrl: 'https://example.com/only?sid=1', metadata: { urls: [] } }),
    );
    expect(result.sourceUrl).toBe('https://example.com/only');
  });

  it('URL が1つも残らなければ主要 URL は null', () => {
    const result = scrubBrowserFact(
      fact({
        sourceUrl: `https://example.com/callback?id_token=${JWT}`,
        metadata: { urls: [{ url: `https://example.com/callback?id_token=${JWT}`, title: '' }] },
      }),
    );

    expect(result.sourceUrl).toBeNull();
    expect((result.metadata as { urls: unknown[] }).urls).toEqual([]);
  });

  it('形の分からない URL の項目は残さない', () => {
    const result = scrubBrowserFact(
      fact({ metadata: { urls: [{ title: 'no url' }, 'string', null] } }),
    );

    expect((result.metadata as { urls: unknown[] }).urls).toEqual([]);
    expect(result.stats.urlsRemoved).toBe(3);
  });

  it.each([null, [1, 2], 'text'])('metadata が %p のときは主要 URL だけ洗う', (metadata) => {
    const result = scrubBrowserFact(fact({ sourceUrl: 'https://example.com/x#frag', metadata }));

    expect(result.sourceUrl).toBe('https://example.com/x');
    expect(result.metadata).toEqual(metadata);
  });

  it.each([
    'https://accounts.google.com/signin/oauth/consent?part=secret',
    'http://localhost:58673/callback?code=secret&state=secret',
    'https://example.com/docs?token=secret#access_token=x',
    'https://www.google.com/search?q=hello+world&sxsrf=secret',
    `https://www.google.com/search?q=${JWT}`,
    'https://www.google.com/url?q=https://example.com/?code=secret',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s',
    'https://user:pass@example.com/path;jsessionid=secret',
  ])('洗った結果をもう一度洗っても変わらない: %s', (url) => {
    const first = scrubBrowserFact(
      fact({
        sourceUrl: url,
        title: `${JWT} を調査`,
        metadata: {
          domains: [new URL(url).hostname],
          search_queries: ['hello world', JWT],
          urls: [{ url, title: 't' }],
        },
      }),
    );
    const second = scrubBrowserFact(first);

    expect(second.changed).toBe(false);
    expect(first.sourceUrl).toBe(sanitizeVisitUrl(url) ?? null);
  });
});
