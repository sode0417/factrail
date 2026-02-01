/**
 * E2Eテストのセットアップ
 * テスト実行前に必要な環境変数を設定する
 */

// テストタイムアウトを30秒に設定（認証処理に時間がかかるため）
jest.setTimeout(30000);

// データベース接続（テスト用）
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/factrail_test';
process.env.NODE_ENV = 'test';

// セキュリティ関連
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// 認証関連の環境変数（テスト用ダミー値）
process.env.JWT_SECRET = 'test-jwt-secret-key-for-e2e-testing-purposes-minimum-32-chars';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3001/auth/google/callback';
process.env.GITHUB_CLIENT_ID = 'test-github-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-github-client-secret';
process.env.GITHUB_CALLBACK_URL = 'http://localhost:3001/auth/github/callback';
process.env.WEB_URL = 'http://localhost:3000';

// Redis関連（テスト用）
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_SESSION_DB = '1';
process.env.REDIS_URL = 'redis://localhost:6379';
