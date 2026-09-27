import { test, expect, type Page } from '@playwright/test';

/**
 * メモの取り込みボタンの E2E テスト。
 *
 * ⚠️ 固定データはすべて作り物。実在の書名・URL・本人のメモを置かないこと
 *    —— `sode0417/factrail` は PUBLIC なリポジトリ。
 */

const IMPORT_URL = '**/api/books/import/kindle';

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
  // 一覧の読み込みは取り込みと別。ここでは 0 件で固定しておく
  await page.route('**/api/books', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[]}' }),
  );
}

/** 作り物の kindle-exporter 出力を、その場でファイルとして渡す。 */
async function pickFile(page: Page, content: string, name = 'dummy-export.json') {
  await page.getByTestId('memo-import-input').setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(content, 'utf-8'),
  });
}

const DUMMY_EXPORT = JSON.stringify({
  books: [{ title: 'テスト用のダミー素材A', asin: 'B000TEST01', highlights: [] }],
});

test.describe('メモの取り込み', () => {
  test('取り込みボタンが一覧の状態に関係なく出ること', async ({ page }) => {
    await signIn(page);
    await page.goto('/memos');

    // 一覧が 0 件でも取り込みはできる
    await expect(page.getByTestId('memos-empty')).toBeVisible();
    await expect(page.getByRole('button', { name: 'メモを取り込む' })).toBeVisible();
  });

  test('取り込みに成功すると、件数の内訳が出ること', async ({ page }) => {
    await signIn(page);
    await page.route(IMPORT_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            books_in_file: 2, books_created: 1, books_existing: 1, books_skipped: 0,
            highlights_in_file: 12, highlights_inserted: 10, highlights_duplicate: 2,
            books_with_notice: 1, books: [], unknown_fields: [],
          },
        }),
      }),
    );

    await page.goto('/memos');
    await pickFile(page, DUMMY_EXPORT);

    const result = page.getByTestId('memo-import-result');
    await expect(result).toBeVisible();
    await expect(result).toContainText('ファイルに入っていた素材');
    await expect(result).toContainText('新しく入ったハイライト');
  });

  test('F2A が返さなかった項目は出さないこと', async ({ page }) => {
    await signIn(page);
    // 🔴 F2A 側で項目名が変わる予定がある。無い項目を 0 と書くと嘘になる
    await page.route(IMPORT_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { books_in_file: 1, books_updated: 1, books_unchanged: 0 },
        }),
      }),
    );

    await page.goto('/memos');
    await pickFile(page, DUMMY_EXPORT);

    const result = page.getByTestId('memo-import-result');
    await expect(result).toBeVisible();
    // 新しい項目名は出る
    await expect(result).toContainText('直した素材');
    await expect(result).toContainText('変わらなかった素材');
    // 返ってこなかった項目は出さない
    await expect(result).not.toContainText('既にあった素材');
    await expect(result).not.toContainText('新しく入ったハイライト');
  });

  test('取り込めなかった素材と、知らない項目を必ず出すこと', async ({ page }) => {
    await signIn(page);
    await page.route(IMPORT_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            books_in_file: 2, books_created: 1, books_skipped: 1,
            books: [
              { title: 'テスト用のダミー素材A', asin: 'B000TEST01', result: 'created', skipped_reason: null, highlights_in_file: 1, highlights_inserted: 1, highlights_duplicate: 0, has_notice: false },
              { title: 'テスト用のダミー素材Z', asin: null, result: 'skipped', skipped_reason: 'ASIN がありません（ダミー理由）', highlights_in_file: 0, highlights_inserted: 0, highlights_duplicate: 0, has_notice: false },
            ],
            unknown_fields: ['books[].dummyNewField'],
          },
        }),
      }),
    );

    await page.goto('/memos');
    await pickFile(page, DUMMY_EXPORT);

    const result = page.getByTestId('memo-import-result');
    // ⭐ 黙って落とさず、理由まで出す
    await expect(result).toContainText('取り込めなかった素材（1 件）');
    await expect(result).toContainText('ASIN がありません（ダミー理由）');
    // ⭐ 取り込みが捨てた情報も出す
    await expect(result).toContainText('F2A が知らない項目が 1 件ありました');
    await expect(result).toContainText('books[].dummyNewField');
  });

  test('件数が1つも返らなければ、成功に見せないこと', async ({ page }) => {
    await signIn(page);
    await page.route(IMPORT_URL, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":{}}' }),
    );

    await page.goto('/memos');
    await pickFile(page, DUMMY_EXPORT);

    await expect(page.getByTestId('memo-import-result')).toContainText(
      'F2A が件数を返しませんでした',
    );
  });

  test('404 のときは「F2A に口がまだない」と分かる文言にすること', async ({ page }) => {
    await signIn(page);
    // 📏 2026-09-27 時点の本番 F2A は /api/books/* がすべて 404
    await page.route(IMPORT_URL, (route) => route.fulfill({ status: 404, body: '' }));

    await page.goto('/memos');
    await pickFile(page, DUMMY_EXPORT);

    const error = page.getByTestId('memo-import-error');
    await expect(error).toBeVisible();
    // 🔴 こちらの作りの誤りと混同されないことが肝
    await expect(error).toContainText('F2A に取り込みの口がまだありません');
    await expect(error).toContainText('こちらの作りの誤りではありません');
    await expect(page.getByTestId('memo-import-result')).toHaveCount(0);
  });

  test('ログイン切れ (401) は 404 と別の文言になること', async ({ page }) => {
    await signIn(page);
    await page.route(IMPORT_URL, (route) => route.fulfill({ status: 401, body: '' }));

    await page.goto('/memos');
    await pickFile(page, DUMMY_EXPORT);

    const error = page.getByTestId('memo-import-error');
    await expect(error).toContainText('F2A にログインできていません');
    await expect(error).not.toContainText('取り込みの口がまだありません');
  });

  test('JSON として読めないファイルは、送らずに手前で止めること', async ({ page }) => {
    await signIn(page);
    let sent = 0;
    await page.route(IMPORT_URL, (route) => {
      sent += 1;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":{}}' });
    });

    await page.goto('/memos');
    await pickFile(page, 'これは JSON ではありません', 'dummy.json');

    await expect(page.getByTestId('memo-import-error')).toContainText(
      'JSON として読めませんでした',
    );
    // ⭐ 送っていないことまで確かめる
    expect(sent).toBe(0);
  });
});
