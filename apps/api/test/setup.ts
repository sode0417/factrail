/**
 * E2Eテストのセットアップ
 * テスト実行前に必要な環境変数を設定する
 */

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
