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

/**
 * 作り物の素材とハイライト。実在しない。
 * ⭐ 並べ替えの確認のため、A のほうが**古い**取り込み時刻にしてある。
 */
const FAKE_BOOKS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'テスト用のダミー素材A',
    author: '著者: ダミー太郎',
    source: 'kindle',
    asin: 'B000TEST01',
    last_highlighted_text: '2020年1月2日木曜日',
    import_notice: null,
    highlights: [
      {
        id: 'aaaaaaa1-1111-4111-8111-111111111111',
        text: 'ダミーのハイライト本文A-1。',
        note: 'ダミーの自分メモA-1。',
        locator: '位置 100',
        locator_type: 'kindle_location',
        color: 'yellow',
        maybe_truncated: false,
        created_at: '2020-01-02T00:00:00Z',
      },
      {
        id: 'aaaaaaa2-1111-4111-8111-111111111111',
        text: 'ダミーのハイライト本文A-2。',
        note: null,
        locator: '位置 200',
        locator_type: 'kindle_location',
        color: 'blue',
        maybe_truncated: false,
        created_at: '2020-01-02T00:00:01Z',
      },
    ],
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    title: 'テスト用のダミー素材B',
    author: null,
    source: 'kindle',
    asin: 'B000TEST02',
    last_highlighted_text: '2020年3月4日水曜日',
    // 🔴 「黙って欠けている」印が出ることを確かめるための素材
    import_notice: '注意: 一部の注釈は表示されていません（ダミー文面）',
    highlights: [
      {
        id: 'bbbbbbb2-2222-4222-8222-222222222222',
        text: 'ダミーのハイライト本文B-1。',
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

/** ⭐ ASIN も URL も無い素材（リンクが作れない場合の表示を確かめる）。 */
const FAKE_BOOK_WITHOUT_LINK = {
  id: '33333333-3333-4333-8333-333333333333',
  title: 'テスト用のダミー素材C（紙）',
  author: null,
  source: 'paper',
  asin: null,
  last_highlighted_text: null,
  import_notice: null,
  highlights: [
    {
      id: 'ccccccc3-3333-4333-8333-333333333333',
      text: 'ダミーのハイライト本文C-1。',
      note: null,
      locator: 'p.12',
      locator_type: 'page',
      color: null,
      maybe_truncated: false,
      created_at: '2020-05-06T00:00:00Z',
    },
  ],
};

/** ダミーの文字列（HTML に漏れていないか調べる用）。 */
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

/** F2A の読み出し口を差し替える。 */
async function stubBooks(page: Page, body: unknown, status = 200) {
  await page.route('**/api/books', (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    }),
  );
}

test.describe('メモページ', () => {
  test('ハイライト・自分のメモ・素材の題名・色が出ること', async ({ page }) => {
    await signIn(page);
    await stubBooks(page, { data: FAKE_BOOKS });

    await page.goto('/memos');

    // 待機に networkidle は使わない (Issue #171)。描画される要素を待つ。
    await expect(page.getByTestId('memos-list')).toBeVisible();

    await expect(page.getByText('ダミーのハイライト本文A-1。')).toBeVisible();
    await expect(page.getByText('ダミーの自分メモA-1。')).toBeVisible();
    await expect(page.getByText('テスト用のダミー素材A')).toBeVisible();
    // 色は名前でも出す（色だけに意味を持たせない）
    await expect(page.getByText('yellow', { exact: true })).toBeVisible();
  });

  test('素材ごとにまとまり、素材どうしは新しい順に並ぶこと', async ({ page }) => {
    await signIn(page);
    await stubBooks(page, { data: FAKE_BOOKS });

    await page.goto('/memos');
    await expect(page.getByTestId('memos-list')).toBeVisible();

    // 📌 本人が「本ごとにまとめる」を選択（2026-09-27 シート 58ddd654 設問 2）
    const groups = page.getByTestId('memo-group');
    await expect(groups).toHaveCount(2);

    // B のほうが取り込みが新しいので先に来る
    await expect(groups.nth(0)).toContainText('テスト用のダミー素材B');
    await expect(groups.nth(1)).toContainText('テスト用のダミー素材A');

    // 素材 A の 2 件は、A のまとまりの中だけに入っている
    await expect(groups.nth(1)).toContainText('ダミーのハイライト本文A-1。');
    await expect(groups.nth(1)).toContainText('ダミーのハイライト本文A-2。');
    await expect(groups.nth(0)).not.toContainText('ダミーのハイライト本文A-1。');

    // 素材の中は受け取った順のまま（A-1 → A-2）
    const textsInA = await groups.nth(1).getByTestId('memo-text').allTextContents();
    expect(textsInA).toEqual([
      'ダミーのハイライト本文A-1。',
      'ダミーのハイライト本文A-2。',
    ]);
  });

  test('元の素材へのリンクが素材ごとに必ず出ること', async ({ page }) => {
    await signIn(page);
    // 🔴 本人の指示（2026-09-27）で、リンクは必ず見える形にする
    await stubBooks(page, { data: [...FAKE_BOOKS, FAKE_BOOK_WITHOUT_LINK] });

    await page.goto('/memos');
    await expect(page.getByTestId('memos-list')).toBeVisible();

    // ⭐ 並び順に左右されないよう、素材のまとまりを題名で特定してから中を見る
    const groupA = page
      .getByTestId('memo-group')
      .filter({ hasText: 'テスト用のダミー素材A' });

    // ASIN のある素材は、飛び先が判る形でリンクが出る
    const link = groupA.getByRole('link', { name: /元の素材へ/ });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute(
      'href',
      'https://read.amazon.co.jp/notebook?asin=B000TEST01',
    );

    // 🔴 リンクは素材ごとに必ず 1 つ出る（リンクか、「リンクなし」のどちらか）
    await expect(page.getByTestId('memo-group')).toHaveCount(3);
    await expect(page.getByRole('link', { name: /元の素材へ/ })).toHaveCount(2);

    // ⛔ リンクが作れない素材は、黙って消さずに「無い」と出す
    await expect(
      page.getByText('リンクなし（F2A にこの素材の URL が入っていません）'),
    ).toBeVisible();
  });

  test('F2A が素材の source_url を持っていれば、そちらを優先して出すこと', async ({ page }) => {
    await signIn(page);
    // 📏 F2A の PR #66 で `books.source_url` として実装済み。web / YouTube もここに乗る
    await stubBooks(page, {
      data: [
        {
          ...FAKE_BOOKS[0],
          source_url: 'https://example.test/dummy-article',
        },
      ],
    });

    await page.goto('/memos');
    await expect(page.getByTestId('memos-list')).toBeVisible();

    const link = page.getByRole('link', { name: /元の素材へ/ }).first();
    await expect(link).toHaveAttribute('href', 'https://example.test/dummy-article');
    // 飛び先が判るようホスト名を出している
    await expect(link).toContainText('example.test');
  });

  test('import_notice のある素材には「全部とは限らない」印が出ること', async ({ page }) => {
    await signIn(page);
    await stubBooks(page, { data: FAKE_BOOKS });

    await page.goto('/memos');

    await expect(
      page.getByText('この素材は、取れたハイライトが全部とは限りません'),
    ).toBeVisible();
  });

  test('0 件のときは「まだありません」が出て、「読み込めませんでした」は出ないこと', async ({
    page,
  }) => {
    await signIn(page);
    await stubBooks(page, { data: [] });

    await page.goto('/memos');

    await expect(page.getByTestId('memos-empty')).toBeVisible();
    await expect(page.getByTestId('memos-error')).toHaveCount(0);
  });

  test('素材はあるがハイライトが 0 件でも「まだありません」になること', async ({ page }) => {
    await signIn(page);
    await stubBooks(page, { data: [{ ...FAKE_BOOKS[0], highlights: [] }] });

    await page.goto('/memos');

    await expect(page.getByTestId('memos-empty')).toBeVisible();
    await expect(page.getByTestId('memos-error')).toHaveCount(0);
  });

  test('取得に失敗したときは「読み込めませんでした」が出て、「まだありません」は出ないこと', async ({
    page,
  }) => {
    await signIn(page);
    await stubBooks(page, { error: 'dummy' }, 500);

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
    await stubBooks(page, { data: FAKE_BOOKS });

    // ブラウザでは（JS が走った後に）本文が見えている
    await page.goto('/memos');
    await expect(page.getByText('ダミーのハイライト本文A-1。')).toBeVisible();

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
