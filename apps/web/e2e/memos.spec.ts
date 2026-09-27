import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, type Page } from '@playwright/test';

/**
 * メモページ（/memos）の E2E テスト。
 *
 * 📏 口の形は F2A の PR #67（`GET /api/media` / `GET /api/media/{id}`）。
 *    ⭐ 2026-09-28 に F2A の開発インスタンス（:3099）へ実際に繋いで突き合わせ済み。
 *
 * ⚠️ 固定データはすべて作り物。実在の書名・URL・本人のメモを置かないこと
 *    —— `sode0417/factrail` は PUBLIC なリポジトリ。
 */

const LIST_URL = '**/api/media?*';
const DETAIL_URL = (id: string) => `**/api/media/${id}`;

/** 作り物の素材（一覧が返す形）。⭐ 並びは F2A が決めるので、この順のまま出るべき。 */
const MEDIA_A = {
  id: 'aaaaaaa1-1111-4111-8111-111111111111',
  title: 'テスト用のダミー素材A',
  author: '著者: ダミー太郎',
  source: 'kindle',
  ingest_via: 'kindle-exporter',
  source_url: null,
  asin: 'B000TEST01',
  tags: [],
  summary: null,
  last_highlighted_text: '2020年1月2日木曜日',
  import_notice: '注意: 一部の注釈は表示されていません（ダミー文面）',
  highlight_count: 2,
  sort_at: '2020-01-02T00:00:00Z',
  created_at: '2020-01-02T00:00:00Z',
  updated_at: '2020-01-02T00:00:00Z',
};

const MEDIA_B = {
  id: 'bbbbbbb2-2222-4222-8222-222222222222',
  title: 'テスト用のダミー素材B（動画）',
  author: null,
  source: 'youtube',
  ingest_via: 'glasp',
  source_url: 'https://example.test/dummy-video',
  asin: null,
  tags: ['ダミータグ'],
  summary: null,
  last_highlighted_text: null,
  import_notice: null,
  highlight_count: 0,
  sort_at: '2019-01-01T00:00:00Z',
  created_at: '2019-01-01T00:00:00Z',
  updated_at: '2019-01-01T00:00:00Z',
};

const HIGHLIGHTS_A = [
  {
    id: 'h1', text: 'ダミーのハイライト本文A-1。', note: 'ダミーの自分メモA-1。',
    locator: '位置 100', locator_type: 'kindle_location', color: 'yellow',
    maybe_truncated: false, highlighted_at: null, created_at: '2020-01-02T00:00:00Z',
  },
  {
    id: 'h2', text: 'ダミーのハイライト本文A-2。', note: null,
    locator: null, locator_type: 'none', color: null,
    maybe_truncated: true, highlighted_at: null, created_at: '2020-01-02T00:00:01Z',
  },
];

function listBody(items: unknown[], meta: Partial<{ has_more: boolean; next_cursor: string | null }> = {}) {
  return { data: items, meta: { has_more: false, next_cursor: null, limit: 50, ...meta } };
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

test.describe('メモページ', () => {
  test('素材ごとに、題名・件数・種別・取得経路・リンクが出ること', async ({ page }) => {
    await signIn(page);
    await stubList(page, listBody([MEDIA_A, MEDIA_B]));

    await page.goto('/memos');

    // 待機に networkidle は使わない (Issue #171)。描画される要素を待つ。
    await expect(page.getByTestId('memos-list')).toBeVisible();

    const sources = page.getByTestId('memo-source');
    await expect(sources).toHaveCount(2);

    await expect(sources.nth(0)).toContainText('テスト用のダミー素材A');
    await expect(sources.nth(0)).toContainText('ハイライト 2 件');
    await expect(sources.nth(0)).toContainText('Kindle');
    // 🔑 「何を読んだか」と「どこから取ったか」は別の軸。両方 出す
    await expect(sources.nth(0)).toContainText('kindle-exporter で取得');
    await expect(sources.nth(1)).toContainText('YouTube');
    await expect(sources.nth(1)).toContainText('Glasp で取得');
    await expect(sources.nth(1)).toContainText('#ダミータグ');
  });

  test('F2A が返した順のまま並べること（こちらで並べ替えない）', async ({ page }) => {
    await signIn(page);
    // ⚠️ わざと「新しいほうが後ろ」の順で返す。
    //    🔴 こちらで並べ替えると、F2A が第2・第3の鍵まで入れて解決した配慮が消える。
    //    📏 F2A 側は「全冊が同時刻になりハイライト0件の素材が上位を占めた」穴を踏んで直している。
    await stubList(page, listBody([MEDIA_B, MEDIA_A]));

    await page.goto('/memos');
    await expect(page.getByTestId('memos-list')).toBeVisible();

    const sources = page.getByTestId('memo-source');
    await expect(sources.nth(0)).toContainText('テスト用のダミー素材B');
    await expect(sources.nth(1)).toContainText('テスト用のダミー素材A');
  });

  test('元の素材へのリンクが素材ごとに必ず出ること', async ({ page }) => {
    await signIn(page);
    await stubList(page, listBody([MEDIA_A, MEDIA_B]));

    await page.goto('/memos');
    await expect(page.getByTestId('memos-list')).toBeVisible();

    // URL がある素材は、飛び先が判る形で出る
    const link = page.getByRole('link', { name: /元の素材へ/ });
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute('href', 'https://example.test/dummy-video');
    await expect(link).toContainText('example.test');

    // ⛔ リンクが作れない素材は、黙って消さずに「無い」と出す
    await expect(
      page.getByText('リンクなし（F2A にこの素材の URL が入っていません）'),
    ).toBeVisible();
  });

  test('import_notice のある素材には「全部とは限らない」印が出ること', async ({ page }) => {
    await signIn(page);
    await stubList(page, listBody([MEDIA_A, MEDIA_B]));

    await page.goto('/memos');

    await expect(page.getByTestId('memo-import-notice')).toHaveCount(1);
    await expect(
      page.getByText('この素材は、取れたハイライトが全部とは限りません'),
    ).toBeVisible();
  });

  test('開くまでハイライトを取りに行かず、開いたら出ること', async ({ page }) => {
    await signIn(page);
    await stubList(page, listBody([MEDIA_A]));
    let detailCalls = 0;
    await page.route(DETAIL_URL(MEDIA_A.id), (route) => {
      detailCalls += 1;
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: { ...MEDIA_A, highlights: HIGHLIGHTS_A, highlights_truncated: false } }),
      });
    });

    await page.goto('/memos');
    await expect(page.getByTestId('memos-list')).toBeVisible();

    // ⭐ 一覧は件数しか持たない。開く前に詳細を叩かない（素材の数だけ叩かないため）
    expect(detailCalls).toBe(0);
    await expect(page.getByTestId('memo-text')).toHaveCount(0);

    await page.getByTestId('memo-source').first().click();

    await expect(page.getByText('ダミーのハイライト本文A-1。')).toBeVisible();
    await expect(page.getByText('ダミーの自分メモA-1。')).toBeVisible();
    // 切れている疑いは断定しない文言で出す
    await expect(
      page.getByText(/本文が途中で切れている疑いがあります/),
    ).toBeVisible();
    expect(detailCalls).toBe(1);
  });

  test('ハイライトが一部しか返らないときは、その旨を出すこと', async ({ page }) => {
    await signIn(page);
    await stubList(page, listBody([MEDIA_A]));
    // 🔴 highlights_truncated を黙って隠さない
    await stubDetail(page, MEDIA_A.id, {
      data: { ...MEDIA_A, highlights: HIGHLIGHTS_A, highlights_truncated: true },
    });

    await page.goto('/memos');
    await page.getByTestId('memo-source').first().click();

    await expect(page.getByTestId('memo-highlights-truncated')).toBeVisible();
    await expect(page.getByTestId('memo-highlights-truncated')).toContainText('全 2 件');
  });

  test('ハイライトの取得に失敗したときは「0 件」と混ぜないこと', async ({ page }) => {
    await signIn(page);
    await stubList(page, listBody([MEDIA_A]));
    await stubDetail(page, MEDIA_A.id, { error: 'dummy' }, 500);

    await page.goto('/memos');
    await page.getByTestId('memo-source').first().click();

    await expect(page.getByTestId('memo-detail-error')).toBeVisible();
    await expect(page.getByTestId('memo-detail-error')).toContainText('0 件なのではありません');
  });

  test('ハイライトが本当に 0 件のときは、そう出すこと', async ({ page }) => {
    await signIn(page);
    await stubList(page, listBody([MEDIA_B]));
    await stubDetail(page, MEDIA_B.id, {
      data: { ...MEDIA_B, highlights: [], highlights_truncated: false },
    });

    await page.goto('/memos');
    await page.getByTestId('memo-source').first().click();

    await expect(page.getByText('この素材にハイライトは入っていません。')).toBeVisible();
    await expect(page.getByTestId('memo-detail-error')).toHaveCount(0);
  });

  test('続きの有無は has_more で決めること（next_cursor の有無で決めない）', async ({ page }) => {
    await signIn(page);
    // 🔴 next_cursor が入っていても has_more が false なら続きは無い。
    //    📏 F2A 担当の忠告（Glasp が「1件でもカーソルを返す」形だった）に基づく。
    await stubList(page, listBody([MEDIA_A], { has_more: false, next_cursor: 'dummy-cursor' }));

    await page.goto('/memos');
    await expect(page.getByTestId('memos-list')).toBeVisible();

    await expect(page.getByTestId('memos-load-more')).toHaveCount(0);
  });

  test('has_more が true なら「もっと読む」で続きを積むこと', async ({ page }) => {
    await signIn(page);
    let call = 0;
    await page.route(LIST_URL, (route) => {
      call += 1;
      const body = call === 1
        ? listBody([MEDIA_A], { has_more: true, next_cursor: 'cursor-1' })
        : listBody([MEDIA_B], { has_more: false, next_cursor: null });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });

    await page.goto('/memos');
    await expect(page.getByTestId('memo-source')).toHaveCount(1);

    await page.getByTestId('memos-load-more').click();

    await expect(page.getByTestId('memo-source')).toHaveCount(2);
    await expect(page.getByTestId('memos-load-more')).toHaveCount(0);
  });

  test('カーソルが壊れて 400 のときは、先頭から読み直してその旨を出すこと', async ({ page }) => {
    await signIn(page);
    let call = 0;
    await page.route(LIST_URL, (route) => {
      call += 1;
      const url = route.request().url();
      // 1回目（カーソル無し）: 続きあり
      if (call === 1) {
        return route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify(listBody([MEDIA_A], { has_more: true, next_cursor: 'stale' })) });
      }
      // 2回目（カーソルつき）: F2A は壊れたカーソルに 400 を返す
      if (url.includes('cursor=')) {
        return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"bad cursor"}' });
      }
      // 3回目（読み直し・カーソル無し）
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(listBody([MEDIA_A, MEDIA_B])) });
    });

    await page.goto('/memos');
    await page.getByTestId('memos-load-more').click();

    // ⛔ 黙って先頭に戻さない。戻したことを画面に出す
    await expect(page.getByTestId('memos-restarted')).toBeVisible();
    // ⛔ 読み直した分を積み増して重複させない
    await expect(page.getByTestId('memo-source')).toHaveCount(2);
  });

  test('0 件のときは「まだありません」が出て、「読み込めませんでした」は出ないこと', async ({ page }) => {
    await signIn(page);
    await stubList(page, listBody([]));

    await page.goto('/memos');

    await expect(page.getByTestId('memos-empty')).toBeVisible();
    await expect(page.getByTestId('memos-error')).toHaveCount(0);
  });

  test('取得に失敗したときは「読み込めませんでした」が出て、「まだありません」は出ないこと', async ({ page }) => {
    await signIn(page);
    await stubList(page, { error: 'dummy' }, 500);

    await page.goto('/memos');

    // 🔴 ここが混ざると、F2A に繋がっていないことに気づけないまま
    //    「まだありません」を出し続ける。
    //    📏 2026-09-27 に実際に効いた: F2A に 5 件 入っているのに読み出し口が
    //    無い状態で、混ぜていたら取り込みの失敗と誤解するところだった。
    await expect(page.getByTestId('memos-error')).toBeVisible();
    await expect(page.getByTestId('memos-empty')).toHaveCount(0);
  });

  test('サーバが返す HTML にメモの本文が 1 文字も載っていないこと', async ({ page, request }) => {
    await signIn(page);
    await stubList(page, listBody([MEDIA_A]));
    await stubDetail(page, MEDIA_A.id, {
      data: { ...MEDIA_A, highlights: HIGHLIGHTS_A, highlights_truncated: false },
    });

    // ブラウザでは（JS が走った後に）本文が見えている
    await page.goto('/memos');
    await page.getByTestId('memo-source').first().click();
    await expect(page.getByText('ダミーのハイライト本文A-1。')).toBeVisible();

    // 🔴 一方、JS を走らせない素の HTTP GET で取った HTML には 1 件も載っていない。
    //    ページ自体はログイン無しで誰でも開けるので、ここに載ったら世界に公開される。
    const response = await request.get('/memos');
    expect(response.status()).toBe(200);
    const html = await response.text();
    for (const text of [
      MEDIA_A.title, MEDIA_A.author, MEDIA_A.import_notice,
      ...HIGHLIGHTS_A.flatMap((h) => [h.text, h.note].filter((v): v is string => !!v)),
    ]) {
      expect(html).not.toContain(text);
    }
  });

  test("page.tsx の先頭が 'use client' であること", () => {
    // 🔴 この 1 行が消えると Next.js はサーバ側で F2A を叩き、読書メモを HTML に
    //    埋めて誰にでも配る。挙動のテストでは（F2A に繋がらない CI では）捕まえ
    //    られないので、ソースを直接見て止める。
    const source = readFileSync(join(__dirname, '../src/app/memos/page.tsx'), 'utf-8');
    expect(source.trimStart().startsWith("'use client';")).toBe(true);
  });
});
