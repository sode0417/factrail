import { test, expect, type Page } from '@playwright/test';

/**
 * メモページ（/memos）の検索の E2E テスト。
 *
 * 📏 探す対象は本人の回答（2026-09-27 22:07）そのまま:
 *    「本文・自分のメモ・本の題名すべて」＋ 自由記述「web や youtube の場合は
 *    そのリンクなども取得してほしい」⇒ 本文 / メモ / 題名 / リンク の 4 つ。
 *
 * 🔴 ここで守りたいのは 2 点:
 *    1. 絞り込みが**ブラウザの中だけ**で行われる（⛔ 検索語をサーバに渡さない）
 *    2. 「一致しなかった」と「そもそも探せていない」を混ぜない
 *
 * ⚠️ 固定データはすべて作り物。実在の書名・URL・本人のメモを置かないこと
 *    —— `sode0417/factrail` は PUBLIC なリポジトリ。
 */

const LIST_URL = '**/api/media?*';
const DETAIL_URL = (id: string) => `**/api/media/${id}`;

/** ハイライト 2 件。⭐ うち 1 件だけが「恒常性」に当たる。 */
const MEDIA_BOOK = {
  id: 'aaaaaaa1-1111-4111-8111-111111111111',
  title: 'ダミー書籍ゼータ',
  author: '著者: ダミー太郎',
  source: 'kindle',
  ingest_via: 'kindle-exporter',
  source_url: null,
  asin: 'B000TEST01',
  tags: [],
  summary: null,
  last_highlighted_text: null,
  import_notice: null,
  highlight_count: 2,
  sort_at: '2020-01-02T00:00:00Z',
  created_at: '2020-01-02T00:00:00Z',
  updated_at: '2020-01-02T00:00:00Z',
};

/** リンクを持つ素材（web / YouTube の代表）。 */
const MEDIA_VIDEO = {
  id: 'bbbbbbb2-2222-4222-8222-222222222222',
  title: 'ダミー動画イプシロン',
  author: null,
  source: 'youtube',
  ingest_via: 'glasp',
  source_url: 'https://example.test/watch?v=dummyzeta',
  asin: null,
  tags: ['ダミータグ'],
  summary: null,
  last_highlighted_text: null,
  import_notice: null,
  highlight_count: 1,
  sort_at: '2019-01-01T00:00:00Z',
  created_at: '2019-01-01T00:00:00Z',
  updated_at: '2019-01-01T00:00:00Z',
};

/** ハイライト 0 件の素材。⭐ 詳細を取りに行く必要が無い（探す中身が無い）。 */
const MEDIA_EMPTY = {
  ...MEDIA_VIDEO,
  id: 'ccccccc3-3333-4333-8333-333333333333',
  title: 'ダミー素材オミクロン',
  source_url: null,
  tags: [],
  highlight_count: 0,
  sort_at: '2018-01-01T00:00:00Z',
};

const BOOK_HIGHLIGHTS = [
  {
    id: 'h1',
    text: '恒常性という語がここに出てくる。',
    note: 'ここは自分のメモ・アルファ。',
    locator: '位置 100',
    locator_type: 'kindle_location',
    color: 'yellow',
    maybe_truncated: false,
    highlighted_at: null,
    created_at: '2020-01-02T00:00:00Z',
  },
  {
    id: 'h2',
    text: '別の行。この行には当たる語を置かない。',
    note: null,
    locator: null,
    locator_type: 'none',
    color: null,
    maybe_truncated: false,
    highlighted_at: null,
    created_at: '2020-01-02T00:00:01Z',
  },
];

const VIDEO_HIGHLIGHTS = [
  {
    id: 'h3',
    text: '動画のハイライト本文。',
    note: null,
    locator: null,
    locator_type: 'none',
    color: null,
    maybe_truncated: false,
    highlighted_at: null,
    created_at: '2019-01-01T00:00:00Z',
  },
];

function listBody(
  items: unknown[],
  meta: Partial<{ has_more: boolean; next_cursor: string | null }> = {},
) {
  return { data: items, meta: { has_more: false, next_cursor: null, limit: 50, ...meta } };
}

function detailBody(media: unknown, highlights: unknown[], truncated = false) {
  return {
    data: { ...(media as object), highlights, highlights_truncated: truncated },
  };
}

async function signIn(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'factrail-auth',
      JSON.stringify({
        state: {
          user: { id: 'e2e-user', email: 'e2e@example.test', name: 'E2E' },
          accessToken: 'e2e-dummy-access-token',
          refreshToken: 'e2e-dummy-refresh-token',
          sessionId: 'e2e-dummy-session',
          isAuthenticated: true,
        },
        version: 0,
      }),
    );
  });
}

async function stubList(page: Page, body: unknown, status = 200) {
  await page.route(LIST_URL, (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

async function stubDetail(page: Page, id: string, body: unknown, status = 200) {
  await page.route(DETAIL_URL(id), (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

/** 3 素材ぶんの既定の stub（一覧 + 詳細）。 */
async function stubAll(page: Page, listMeta = {}) {
  await stubList(page, listBody([MEDIA_BOOK, MEDIA_VIDEO, MEDIA_EMPTY], listMeta));
  await stubDetail(page, MEDIA_BOOK.id, detailBody(MEDIA_BOOK, BOOK_HIGHLIGHTS));
  await stubDetail(page, MEDIA_VIDEO.id, detailBody(MEDIA_VIDEO, VIDEO_HIGHLIGHTS));
  await stubDetail(page, MEDIA_EMPTY.id, detailBody(MEDIA_EMPTY, []));
}

/** 検索語を入れて、探し終わるまで待つ。 */
async function typeQuery(page: Page, query: string) {
  await page.getByTestId('memos-search-input').fill(query);
  // 🔴 「読み込み中」が消えてから件数を見る（⛔ 途中の 0 件を読まない）
  await expect(page.getByTestId('memos-search-loading')).toHaveCount(0);
}

test.describe('メモページの検索', () => {
  test('題名で絞り込めること', async ({ page }) => {
    await signIn(page);
    await stubAll(page);

    await page.goto('/memos');
    await expect(page.getByTestId('memos-list')).toBeVisible();
    await expect(page.getByTestId('memo-source')).toHaveCount(3);

    await typeQuery(page, 'イプシロン');

    const sources = page.getByTestId('memo-source');
    await expect(sources).toHaveCount(1);
    await expect(sources.first()).toContainText('ダミー動画イプシロン');
    // ⭐ 題名だけが当たったことを書く（⛔ 本文に書いてあると読まれないため）
    await expect(page.getByTestId('memo-match-note')).toContainText(
      '題名が一致（本文・メモの一致は 0 件）',
    );
  });

  test('ハイライトの本文で絞り込め、当たった分だけ出ること', async ({ page }) => {
    await signIn(page);
    await stubAll(page);

    await page.goto('/memos');
    await typeQuery(page, '恒常性');

    await expect(page.getByTestId('memo-source')).toHaveCount(1);
    await expect(page.getByTestId('memo-source').first()).toContainText('ダミー書籍ゼータ');

    // ⭐ 当たったハイライトだけ出し、隠した件数を書く
    await expect(page.getByTestId('memo-text')).toHaveCount(1);
    await expect(page.getByTestId('memo-text')).toContainText('恒常性という語');
    await expect(page.getByTestId('memo-match-note')).toContainText(
      'ハイライト 2 件のうち 1 件が一致',
    );
    await expect(page.getByTestId('memos-search-summary')).toContainText(
      '素材 1 件 / ハイライト 1 件が一致',
    );
  });

  test('自分で付けたメモ（note）で絞り込めること', async ({ page }) => {
    await signIn(page);
    await stubAll(page);

    await page.goto('/memos');
    await typeQuery(page, 'アルファ');

    await expect(page.getByTestId('memo-source')).toHaveCount(1);
    await expect(page.getByTestId('memo-text')).toHaveCount(1);
    await expect(page.getByText('ここは自分のメモ・アルファ。')).toBeVisible();
  });

  test('素材のリンクで絞り込めること（web / YouTube の URL）', async ({ page }) => {
    await signIn(page);
    await stubAll(page);

    await page.goto('/memos');
    await typeQuery(page, 'dummyzeta');

    await expect(page.getByTestId('memo-source')).toHaveCount(1);
    await expect(page.getByTestId('memo-source').first()).toContainText('ダミー動画イプシロン');
    await expect(page.getByTestId('memo-match-note')).toContainText('リンクが一致');
    // ⭐ 当たった素材からリンクへ辿れる
    await expect(page.getByRole('link', { name: /元の素材へ/ })).toHaveAttribute(
      'href',
      MEDIA_VIDEO.source_url,
    );
  });

  test('全角で入れても半角と同じに当たること（NFKC）', async ({ page }) => {
    await signIn(page);
    await stubAll(page);

    await page.goto('/memos');
    await typeQuery(page, 'ＤＵＭＭＹＺＥＴＡ');

    await expect(page.getByTestId('memo-source')).toHaveCount(1);
    await expect(page.getByTestId('memo-source').first()).toContainText('ダミー動画イプシロン');
  });

  test('検索語を入れるまで詳細を取りに行かず、入れたら本文を持つ素材だけ取ること', async ({
    page,
  }) => {
    await signIn(page);
    await stubList(page, listBody([MEDIA_BOOK, MEDIA_VIDEO, MEDIA_EMPTY]));

    const calls: string[] = [];
    for (const media of [MEDIA_BOOK, MEDIA_VIDEO, MEDIA_EMPTY]) {
      const highlights =
        media.id === MEDIA_BOOK.id
          ? BOOK_HIGHLIGHTS
          : media.id === MEDIA_VIDEO.id
            ? VIDEO_HIGHLIGHTS
            : [];
      await page.route(DETAIL_URL(media.id), (route) => {
        calls.push(media.id);
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(detailBody(media, highlights)),
        });
      });
    }

    await page.goto('/memos');
    await expect(page.getByTestId('memos-list')).toBeVisible();
    // ⭐ 一覧の描画では 1 件も叩かない
    expect(calls).toHaveLength(0);

    await typeQuery(page, '恒常性');

    // ⭐ ハイライト 0 件の素材は取りに行かない（探す中身が無い）
    expect(calls.sort()).toEqual([MEDIA_BOOK.id, MEDIA_VIDEO.id].sort());
    expect(calls).not.toContain(MEDIA_EMPTY.id);
  });

  test('検索語をサーバに渡さないこと（絞り込みはブラウザの中だけ）', async ({ page }) => {
    await signIn(page);
    await stubAll(page);

    const urls: string[] = [];
    page.on('request', (request) => urls.push(request.url()));

    await page.goto('/memos');
    await typeQuery(page, '恒常性');
    await expect(page.getByTestId('memo-text')).toHaveCount(1);

    // 🔴 検索語が 1 度も外へ出ていないこと。出ていたら絞り込みがサーバ側に
    //    寄っている＝結果を HTML に載せる道が開いている。
    const leaked = urls.filter(
      (url) => url.includes('恒常性') || url.includes(encodeURIComponent('恒常性')),
    );
    expect(leaked).toEqual([]);
  });

  test('探し終わって 0 件のときだけ「ありません」を出すこと', async ({ page }) => {
    await signIn(page);
    await stubAll(page);

    await page.goto('/memos');
    await typeQuery(page, 'どこにも無い語オメガ');

    await expect(page.getByTestId('memos-search-empty')).toBeVisible();
    await expect(page.getByTestId('memo-source')).toHaveCount(0);
    // ⭐ 何を探したかを書いておく（著者・タグは対象外）
    await expect(page.getByTestId('memos-search-empty')).toContainText('著者やタグは対象に入って');
  });

  test('本文を読み込めなかった素材は「探せていない」と出し、0 件に混ぜないこと', async ({
    page,
  }) => {
    await signIn(page);
    await stubList(page, listBody([MEDIA_BOOK, MEDIA_VIDEO]));
    // 🔴 本文が取れない＝探していない。⛔ 「一致しなかった」と混ぜない
    await stubDetail(page, MEDIA_BOOK.id, { error: 'dummy' }, 500);
    await stubDetail(page, MEDIA_VIDEO.id, detailBody(MEDIA_VIDEO, VIDEO_HIGHLIGHTS));

    await page.goto('/memos');
    await typeQuery(page, '恒常性');

    const notice = page.getByTestId('memos-search-unsearched');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('ダミー書籍ゼータ');
    await expect(notice).toContainText('本文を読み込めませんでした');
    await expect(notice).toContainText('題名とリンクだけで判定しました');
  });

  test('ハイライトが一部しか返っていない素材は「探せていない」に数えること', async ({ page }) => {
    await signIn(page);
    await stubList(page, listBody([MEDIA_BOOK]));
    // 🔴 highlights_truncated: 出ていない本文は探せていない
    await stubDetail(page, MEDIA_BOOK.id, detailBody(MEDIA_BOOK, BOOK_HIGHLIGHTS, true));

    await page.goto('/memos');
    await typeQuery(page, '恒常性');

    // 当たった分は出る
    await expect(page.getByTestId('memo-text')).toHaveCount(1);
    // ⭐ そのうえで「全部を探したわけではない」と出す
    const notice = page.getByTestId('memos-search-unsearched');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('ハイライトが一部しか返っていません');
    // ⭐ 素材ごとの一行にも、件数が「出ている分の中での件数」だと書く
    await expect(page.getByTestId('memo-match-note')).toContainText(
      '返っていないハイライトは探せていません',
    );
  });

  test('題名だけ当たった素材の本文が読み込めないとき、「0 件」と書かないこと', async ({
    page,
  }) => {
    await signIn(page);
    await stubList(page, listBody([MEDIA_BOOK]));
    // 🔴 題名は当たるが、本文・メモは見に行けていない状態
    await stubDetail(page, MEDIA_BOOK.id, { error: 'dummy' }, 500);

    await page.goto('/memos');
    await typeQuery(page, 'ゼータ');

    const note = page.getByTestId('memo-match-note');
    await expect(note).toContainText('本文・メモを読み込めなかったので探せていません');
    // ⛔ 「0 件だった」と言わない（0 件なのではなく見ていない）
    await expect(note).not.toContainText('0 件');
  });

  test('読み込みが終われば、まだ読み込めていない素材の一覧は残らないこと', async ({ page }) => {
    await signIn(page);
    await stubAll(page);

    await page.goto('/memos');
    await typeQuery(page, '恒常性');

    // ⭐ 「まだ読み込めていません」はスピナーの行が言う。一覧には出さない
    //    （⛔ 隠すのではなく、二重に言わないだけ。失敗・一部だけは必ず名前つきで出る）
    await expect(page.getByTestId('memos-search-unsearched')).toHaveCount(0);
  });

  test('続きが未読込のときは、検索の対象外だと出すこと', async ({ page }) => {
    await signIn(page);
    await stubAll(page, { has_more: true, next_cursor: 'cursor-1' });

    await page.goto('/memos');
    await typeQuery(page, '恒常性');

    await expect(page.getByTestId('memos-search-has-more')).toBeVisible();
    await expect(page.getByTestId('memos-search-has-more')).toContainText(
      'まだ読み込んでいない素材があります',
    );
  });

  test('検索中も F2A が返した順のまま並べること（一致件数で並べ替えない）', async ({ page }) => {
    await signIn(page);
    // 「ダミー」は 3 素材すべての題名に含まれる。⭐ 当たり数は素材 B のほうが少ない
    await stubAll(page);

    await page.goto('/memos');
    await typeQuery(page, 'ダミー');

    const sources = page.getByTestId('memo-source');
    await expect(sources).toHaveCount(3);
    await expect(sources.nth(0)).toContainText('ダミー書籍ゼータ');
    await expect(sources.nth(1)).toContainText('ダミー動画イプシロン');
    await expect(sources.nth(2)).toContainText('ダミー素材オミクロン');
  });

  test('検索語を消すと元の一覧に戻ること', async ({ page }) => {
    await signIn(page);
    await stubAll(page);

    await page.goto('/memos');
    await typeQuery(page, '恒常性');
    await expect(page.getByTestId('memo-source')).toHaveCount(1);

    await page.getByTestId('memos-search-clear').click();

    await expect(page.getByTestId('memo-source')).toHaveCount(3);
    // ⛔ 絞っていないときに件数や注意書きを出さない
    await expect(page.getByTestId('memos-search-summary')).toHaveCount(0);
    await expect(page.getByTestId('memo-match-note')).toHaveCount(0);
    // ⭐ 検索で開いた中身は畳まれる（検索前と同じ状態に戻る）
    await expect(page.getByTestId('memo-text')).toHaveCount(0);
  });

  test('ハイライト 0 件の素材が題名で当たっても、読み込み中のままで止まらないこと', async ({
    page,
  }) => {
    await signIn(page);
    await stubList(page, listBody([MEDIA_EMPTY]));
    // ⭐ 検索のために詳細を取りに行かない素材（ハイライト 0 件）。
    //    ⛔ 詳細が来ないからといって spinner を回し続けない
    let detailCalls = 0;
    await page.route(DETAIL_URL(MEDIA_EMPTY.id), (route) => {
      detailCalls += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(detailBody(MEDIA_EMPTY, [])),
      });
    });

    await page.goto('/memos');
    await typeQuery(page, 'オミクロン');

    await expect(page.getByTestId('memo-source')).toHaveCount(1);
    await expect(page.getByText('この素材にハイライトは入っていません。')).toBeVisible();
    expect(detailCalls).toBe(0);
  });

  test('サーバが返す HTML に、検索の有無に関わらずメモの本文が載っていないこと', async ({
    page,
    request,
  }) => {
    await signIn(page);
    await stubAll(page);

    await page.goto('/memos');
    await typeQuery(page, '恒常性');
    await expect(page.getByTestId('memo-text')).toContainText('恒常性');

    // 🔴 ページ自体はログイン無しで誰でも開ける。ここに載ったら世界に公開される
    const response = await request.get('/memos');
    expect(response.status()).toBe(200);
    const html = await response.text();
    for (const text of [
      MEDIA_BOOK.title,
      MEDIA_VIDEO.title,
      MEDIA_VIDEO.source_url,
      ...BOOK_HIGHLIGHTS.flatMap((h) => [h.text, h.note].filter((v): v is string => !!v)),
    ]) {
      expect(html).not.toContain(text);
    }
  });
});
