import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E テスト設定
 * Web UIの自動テストを実行する
 */
export default defineConfig({
  // テストディレクトリ
  testDir: './e2e',

  // タイムアウト設定（30秒）
  timeout: 30 * 1000,

  // 並列実行の設定
  fullyParallel: true,

  // CI環境でのリトライ設定
  retries: process.env.CI ? 2 : 0,

  // ワーカー数（CI環境では1、ローカルでは並列実行）
  workers: process.env.CI ? 1 : undefined,

  // レポーター設定
  reporter: [
    ['html'],
    ['list'],
    ...(process.env.CI ? [['github'] as const] : []),
  ],

  // すべてのテストで共通の設定
  use: {
    // ベースURL（テスト内で相対パスを使用可能）
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // スクリーンショットの設定（失敗時のみ）
    screenshot: 'only-on-failure',

    // ビデオの設定（失敗時のみ）
    video: 'retain-on-failure',

    // トレースの設定（失敗時のみ）
    trace: 'retain-on-failure',
  },

  // テスト対象のブラウザ設定
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // CI環境ではChromiumのみ、ローカルでは複数ブラウザでテスト可能
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // 開発サーバーの設定（テスト実行時に自動起動）
  webServer: {
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});
