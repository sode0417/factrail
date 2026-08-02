import { test, expect } from '@playwright/test';

/**
 * ホームページ E2Eテスト（CI用スモークテスト）
 * Webアプリケーションの基本的な動作を確認する
 */
test.describe('ホームページ', () => {
  test('ページが正常に読み込まれること', async ({ page }) => {
    // ホームページにアクセス
    await page.goto('/');

    // ページタイトルまたは主要な要素が存在することを確認
    // Note: 実際のアプリケーションの構造に応じて調整が必要
    await expect(page).toHaveTitle(/Factrail/i);
  });

  test('ページに主要なコンテンツが表示されること', async ({ page }) => {
    await page.goto('/');

    // "/" は /facts へリダイレクトされ、未認証だと AuthGuard が /login へ送る。
    // CI は常に未認証（localStorage が空）なので、到達先は /login で確定する。
    await expect(page).toHaveURL(/\/login$/);

    // 待機に networkidle は使わない。通信が止まる保証がなくタイムアウトしていた (Issue #171)。
    // 代わりにログイン画面の実要素が描画されるのを待つ。
    // これでリダイレクトの連鎖 ("/" → /facts → /login) が最後まで通ったことも確認できる。
    await expect(
      page.getByRole('heading', { name: 'ようこそ' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'ログイン', exact: true }),
    ).toBeVisible();
  });

  test('ページが5秒以内に読み込まれること（パフォーマンステスト）', async ({
    page,
  }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const loadTime = Date.now() - startTime;

    // 5秒以内に読み込まれることを確認
    expect(loadTime).toBeLessThan(5000);
  });
});
