import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, type Page } from '@playwright/test';

/**
 * メモページ（/memos）の E2E テスト。
 *
 * ⚠️ 固定データはすべて作り物。実在の書名・URL・本人のメモを置かないこと
 *    —— `sode0417/factrail` は PUBLIC なリポジトリで、ここに書いたものは
 *    そのまま世界中から読める。
 */

/** 作り物の本とハイライト。実在しない。 */
const FAKE_BOOKS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'テスト用のダミー書籍A',
    author: '著者: ダミー太郎',
    source: 'kindle',
    asin: 'B000TEST01',
    last_highlighted_text: '2020年1月2日木曜日',
    import_notice: null,
    highlights: [
      {
        id: 'aaaaaaa1-1111-4111-8111-111111111111',
        text: 'ダミーのハイライト本文その1。',
        note: 'ダミーの自分メモその1。',
        locator: '位置 100',
        locator_type: 'kindle_location',
        color: 'yellow',
        maybe_truncated: false,
        created_at: '2020-01-02T00:00:00Z',
      },
    ],
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    title: 'テスト用のダミー書籍B',
    author: null,
    source: 'kindle',
    asin: 'B000TEST02',
    last_highlighted_text: '2020年3月4日水曜日',
    // 🔴 「黙って欠けている」印が出ることを確かめるための本
    import_notice: '注意: 一部の注釈は表示されていません（ダミー文面）',
    highlights: [
      {
        id: 'bbbbbbb2-2222-4222-8222-222222222222',
        text: 'ダミーのハイライト本文その2。',
        note: null,
        locator: null,
        locator_type: null,
        color: 'pink',
        maybe_truncated: true,
        created_at: '2020-03-04T00:00:00Z',
      },
    ],
  },
];

/** ダミーのハイライト本文だけを集めたもの（HTML に漏れていないか調べる用）。 */
const FAKE_TEXTS = FAKE_BOOKS.flatMap((b) => [
  b.title,
  ...b.highlights.flatMap((h) => [h.text, h.note].filter((v): v is string => !!v)),
]);

/**
 * AuthGuard を通すためにログイン済みの状態を仕込む。
 * ⚠️ ここで入れるトークンは作り物。AuthGuard は localStorage しか見ていないので、
 *    画面の描画を確かめるにはこれで足りる。
 */
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

test.describe('メモページ', () => {
  test('ハイライト・自分のメモ・書名・色・リンクが出ること', async ({ page }) => {
    await signIn(page);
    await page.route('**/api/books', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: FAKE_BOOKS }),
      }),
    );

    await page.goto('/memos');

    // 待機に networkidle は使わない (Issue #171)。描画される要素を待つ。
    await expect(page.getByTestId('memos-list')).toBeVisible();

    await expect(page.getByText('ダミーのハイライト本文その1。')).toBeVisible();
    await expect(page.getByText('ダミーの自分メモその1。')).toBeVisible();
    await expect(page.getByText('テスト用のダミー書籍A')).toBeVisible();
    // 色は名前でも出す（色だけに意味を持たせない）
    await expect(page.getByText('yellow', { exact: true })).toBeVisible();
    // 元の素材へのリンク（ASIN のある本にだけ出る）
    await expect(
      page.getByRole('link', { name: /元の素材へ/ }).first(),
    ).toBeVisible();
  });

  test('import_notice のある本には「全部とは限らない」印が出ること', async ({ page }) => {
    await signIn(page);
    await page.route('**/api/books', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: FAKE_BOOKS }),
      }),
    );

    await page.goto('/memos');

    await expect(
      page.getByText('この本は、取れたハイライトが全部とは限りません'),
    ).toBeVisible();
  });

  test('0 件のときは「まだありません」が出て、「読み込めませんでした」は出ないこと', async ({
    page,
  }) => {
    await signIn(page);
    await page.route('**/api/books', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      }),
    );

    await page.goto('/memos');

    await expect(page.getByTestId('memos-empty')).toBeVisible();
    await expect(page.getByTestId('memos-error')).toHaveCount(0);
  });

  test('取得に失敗したときは「読み込めませんでした」が出て、「まだありません」は出ないこと', async ({
    page,
  }) => {
    await signIn(page);
    await page.route('**/api/books', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'dummy' }),
      }),
    );

    await page.goto('/memos');

    // 🔴 ここが混ざると、F2A に繋がっていないことに気づけないまま
    //    「まだありません」を出し続ける
    await expect(page.getByTestId('memos-error')).toBeVisible();
    await expect(page.getByTestId('memos-empty')).toHaveCount(0);
  });

  test('サーバが返す HTML にメモの本文が 1 文字も載っていないこと', async ({
    page,
    request,
  }) => {
    await signIn(page);
    await page.route('**/api/books', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: FAKE_BOOKS }),
      }),
    );

    // ブラウザでは（JS が走った後に）本文が見えている
    await page.goto('/memos');
    await expect(page.getByText('ダミーのハイライト本文その1。')).toBeVisible();

    // 🔴 一方、JS を走らせない素の HTTP GET で取った HTML には 1 件も載っていない。
    //    ページ自体はログイン無しで誰でも開けるので、ここに載ったら世界に公開される。
    const response = await request.get('/memos');
    expect(response.status()).toBe(200);
    const html = await response.text();
    for (const text of FAKE_TEXTS) {
      expect(html).not.toContain(text);
    }
  });

  test("page.tsx の先頭が 'use client' であること", () => {
    // 🔴 この 1 行が消えると Next.js はサーバ側で F2A を叩き、読書メモを HTML に
    //    埋めて誰にでも配る。挙動のテストでは（F2A に繋がらない CI では）捕まえ
    //    られないので、ソースを直接見て止める。
    const source = readFileSync(
      join(__dirname, '../src/app/memos/page.tsx'),
      'utf-8',
    );
    expect(source.trimStart().startsWith("'use client';")).toBe(true);
  });
});
