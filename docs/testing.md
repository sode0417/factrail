# テスト環境ガイド

このドキュメントでは、Factrailプロジェクトのテスト環境とCI/CD設定について説明します。

## テスト構成

### API テスト (apps/api)

#### E2Eテスト
- **テストフレームワーク**: Jest + Supertest
- **設定ファイル**: `apps/api/test/jest-e2e.json`
- **テストファイル**: `apps/api/test/*.e2e-spec.ts`

#### 実装済みテスト

##### Health Check (`health.e2e-spec.ts`)
```bash
npm run test:e2e -- health.e2e-spec.ts
```

**テストケース**:
- GET /health のステータス200確認
- レスポンス形式の検証（status, timestamp, services）
- データベース接続状態の確認
- タイムスタンプのISO 8601形式検証

##### Facts API (`facts.e2e-spec.ts`)
```bash
npm run test:e2e -- facts.e2e-spec.ts
```

**テストケース**:
- **GET /api/facts**: 一覧取得、ページネーション、クエリパラメータ
- **POST /api/facts**: 記録作成、バリデーションエラー
- **GET /api/facts/:id**: ID指定取得、404エラー、不正なID形式

#### テスト実行

```bash
# すべてのE2Eテストを実行
cd apps/api
npm run test:e2e

# 特定のテストファイルのみ実行
npm run test:e2e -- health.e2e-spec.ts

# カバレッジ付きで実行
npm run test:cov
```

### Web E2Eテスト (apps/web)

#### E2Eテスト
- **テストフレームワーク**: Playwright
- **設定ファイル**: `apps/web/playwright.config.ts`
- **テストファイル**: `apps/web/e2e/*.spec.ts`

#### 実装済みテスト

##### ホームページ (`home.spec.ts`)
```bash
npm run test:e2e
```

**テストケース**:
- ページが正常に読み込まれること
- 主要なコンテンツが表示されること
- ページが5秒以内に読み込まれること（パフォーマンステスト）

#### テスト実行

```bash
# すべてのE2Eテストを実行
cd apps/web
npm run test:e2e

# UIモードで実行（ローカル開発時）
npm run test:e2e:ui

# テストレポートを表示
npm run test:e2e:report
```

## CI/CD設定

### GitHub Actions ワークフロー

ファイル: `.github/workflows/test.yml`

#### API Tests ジョブ

**サービス**:
- PostgreSQL 16（テスト用データベース）
- Redis 7（キュー処理用）

**実行内容**:
1. 依存関係のインストール
2. Prisma Client生成
3. データベースマイグレーション
4. E2Eテスト実行

**環境変数**:
- `DATABASE_URL`: postgresql://postgres:postgres@localhost:5432/factrail_test
- `REDIS_URL`: redis://localhost:6379
- `ENCRYPTION_KEY`: test-encryption-key-32-chars!!
- `NODE_ENV`: test

#### Web E2E Tests ジョブ

**実行内容**:
1. 依存関係のインストール
2. Playwrightブラウザのインストール（Chromiumのみ）
3. Next.jsアプリのビルド
4. Playwrightテスト実行

**環境変数**:
- `CI`: true
- `BASE_URL`: http://localhost:3000
- `NEXT_PUBLIC_API_URL`: http://localhost:3001

### テスト失敗時の対応

テストが失敗した場合、以下のアーティファクトがGitHub Actionsにアップロードされます:

- **API Tests**: `api-test-results/`（保存期間: 7日間）
- **Web E2E Tests**:
  - `playwright-report/`（保存期間: 7日間）
  - `playwright-screenshots/`（保存期間: 7日間）

## ローカル開発環境でのテスト実行

### 前提条件

#### API テスト
- PostgreSQL実行中
- Redis実行中
- `.env`ファイルに適切な環境変数を設定

#### Web E2E テスト
- Playwrightブラウザがインストール済み

```bash
cd apps/web
npx playwright install
```

### テスト実行手順

#### API E2Eテスト

```bash
cd apps/api

# 環境変数を設定
export DATABASE_URL="postgresql://user:password@localhost:5432/factrail_test"
export REDIS_URL="redis://localhost:6379"
export ENCRYPTION_KEY="your-32-character-encryption-key"

# マイグレーション実行
npx prisma migrate deploy

# テスト実行
npm run test:e2e
```

#### Web E2Eテスト

```bash
cd apps/web

# 開発サーバーを起動（別ターミナル）
npm run dev

# E2Eテスト実行
npm run test:e2e

# UIモードで実行（推奨）
npm run test:e2e:ui
```

## テストカバレッジ目標

### サービス層
- **目標**: 80%以上
- **対象**: FactsService, WebhooksService, IntegrationsService等

### コントローラー層
- **目標**: 70%以上
- **対象**: FactsController, WebhooksController等

## 今後の拡張予定

### ユニットテスト
- [ ] FactsService テスト
- [ ] WebhooksService テスト（署名検証を含む）
- [ ] IntegrationsService テスト

### E2Eテスト
- [ ] Webhooks E2Eテスト
- [ ] エラーレスポンステスト
- [ ] Rate Limitテスト

### インテグレーションテスト
- [ ] GitHub Webhook受信テスト（モック）
- [ ] Slack API呼び出しテスト（モック）

詳細は [Issue #10](https://github.com/sode0417/factrail/issues/10) を参照してください。

## トラブルシューティング

### API E2Eテストが失敗する場合

1. **データベース接続エラー**
   - PostgreSQLが起動していることを確認
   - DATABASE_URL環境変数が正しいことを確認

2. **Redis接続エラー**
   - Redisが起動していることを確認
   - REDIS_URL環境変数が正しいことを確認

3. **Prismaマイグレーションエラー**
   - `npx prisma migrate deploy`を実行
   - `npx prisma generate`でクライアントを再生成

### Web E2Eテストが失敗する場合

1. **Playwrightブラウザが見つからない**
   ```bash
   npx playwright install
   ```

2. **開発サーバーが起動しない**
   - `npm run dev`で手動起動してエラーを確認
   - ポート3000が他のプロセスで使用されていないか確認

3. **タイムアウトエラー**
   - `playwright.config.ts`のタイムアウト設定を調整
   - ネットワーク接続を確認

## 参考リンク

- [Jest ドキュメント](https://jestjs.io/docs/getting-started)
- [Supertest ドキュメント](https://github.com/visionmedia/supertest)
- [Playwright ドキュメント](https://playwright.dev/docs/intro)
- [NestJS テストガイド](https://docs.nestjs.com/fundamentals/testing)
