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

    // ページが完全に読み込まれるまで待機
    await page.waitForLoadState('networkidle');

    // ページの基本的な構造を確認
    // Note: 実際のUIコンポーネントに応じて調整が必要
    const body = page.locator('body');
    await expect(body).toBeVisible();
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
