# Factrail - 開発者向けクイックリファレンス

## よく使うコマンド

### プロジェクトのセットアップ

```bash
# 依存関係インストール（pnpm workspace のためルートで一括。
# apps/api や apps/web で個別に実行する必要はない）
pnpm install

# 環境変数設定
cp apps/api/.env.example apps/api/.env
# .envを編集して実際の値を設定
```

### 開発サーバー

```bash
# API開発サーバー起動（ポート3001）
cd apps/api
pnpm run start:dev

# Web開発サーバー起動（ポート3000）
cd apps/web
pnpm run dev
```

### データベース操作

```bash
# マイグレーション生成
cd apps/api
npx prisma migrate dev --name <migration_name>

# マイグレーション適用
npx prisma migrate deploy

# スキーマ同期（開発環境）
npx prisma db push

# Prisma Client再生成
npx prisma generate

# Prisma Studio起動（DBブラウザ）
npx prisma studio
```

### Git操作

```bash
# 現在のブランチ確認
git branch

# 新しいブランチ作成
git checkout -b claude/issue-<番号>-<機能名>

# 変更をステージング
git add .

# コミット
git commit -m "feat: 機能の説明"

# プッシュ
git push -u origin <branch-name>
```

### テスト

```bash
# ユニットテスト実行
cd apps/api
pnpm run test

# E2Eテスト実行
pnpm run test:e2e

# カバレッジ付きテスト
pnpm run test:cov

# Watch モード
pnpm run test:watch
```

### デプロイ

本番は Mac mini + Cloudflare Tunnel。`main` への push で GitHub Actions
（self-hosted runner `mac-mini-factrail`）が `scripts/deploy.sh` を自動実行する。
Railway / Vercel は 2026-03-15 に廃止済み。

```bash
# 手動デプロイ（Mac mini 上で実行）
cd ~/Projects/factrail
./scripts/deploy.sh          # 全サービス
./scripts/deploy.sh api      # API のみ
./scripts/deploy.sh web      # Web のみ

# GitHub から手動トリガー（workflow_dispatch）
gh workflow run deploy.yml -f service=web
```

ビルド不要でサービスを再起動するだけなら launchctl を直接使う。
`unload` → `load` ではなく `kickstart -k` を使うこと（旧プロセスが残ることがあるため）。

```bash
launchctl kickstart -k gui/$(id -u)/com.sode.factrail-api
launchctl kickstart -k gui/$(id -u)/com.sode.factrail-web
```

## 主要ファイルの場所

### Backend（API）

| 機能 | ファイルパス |
|------|-------------|
| **エントリーポイント** | `apps/api/src/main.ts` |
| **ルートモジュール** | `apps/api/src/app.module.ts` |
| **DBスキーマ** | `apps/api/prisma/schema.prisma` |
| **環境変数** | `apps/api/.env` |
| **Facts管理** | `apps/api/src/facts/facts.service.ts` |
| **Integrations管理** | `apps/api/src/integrations/integrations.service.ts` |
| **Slack OAuth** | `apps/api/src/integrations/slack-oauth.service.ts` |
| **Webhook受信** | `apps/api/src/webhooks/webhooks.controller.ts` |
| **Webhook処理** | `apps/api/src/webhooks/webhooks.service.ts` |
| **Slack投稿** | `apps/api/src/dispatchers/slack-dispatcher.service.ts` |
| **Queue処理** | `apps/api/src/dispatchers/slack-dispatcher.processor.ts` |
| **暗号化** | `apps/api/src/common/crypto/crypto.service.ts` |

### Frontend（Web）

| 機能 | ファイルパス |
|------|-------------|
| **ホーム** | `apps/web/src/app/page.tsx` |
| **レイアウト** | `apps/web/src/app/layout.tsx` |
| **GitHub OAuth** | `apps/web/src/app/setup/github/page.tsx` |
| **Slack OAuth** | `apps/web/src/app/setup/slack/page.tsx` |
| **Slack Callback** | `apps/web/src/app/setup/slack/callback/page.tsx` |
| **Facts表示** | `apps/web/src/app/facts/page.tsx` |
| **OAuth Utils** | `apps/web/src/utils/oauth.ts` |
| **Header** | `apps/web/src/components/layout/Header.tsx` |

## APIエンドポイント

### Facts

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/facts` | Fact一覧取得（カーソルベースページネーション） |
| GET | `/api/facts/:id` | 特定のFact取得 |
| POST | `/api/facts` | 新規Fact作成 |
| PATCH | `/api/facts/:id` | Fact更新 |
| DELETE | `/api/facts/:id` | Fact削除 |

**クエリパラメータ（GET /api/facts）:**
- `limit`: 取得件数（デフォルト: 20）
- `cursor`: カーソル（前回のレスポンスから）
- `source`: ソースフィルター（例: github, slack）
- `type`: タイプフィルター

### Integrations

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/integrations` | 連携一覧取得 |
| GET | `/api/integrations/:id` | 特定の連携取得 |
| POST | `/api/integrations` | 新規連携作成 |
| PATCH | `/api/integrations/:id` | 連携更新 |
| DELETE | `/api/integrations/:id` | 連携削除 |
| POST | `/api/integrations/slack/oauth/authorize` | Slack OAuth認証開始 |
| POST | `/api/integrations/slack/oauth/callback` | Slack OAuth コールバック |

### Webhooks

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| POST | `/api/webhooks/github` | GitHub Webhook受信 |

### Settings

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/settings/:provider/:settingType` | 設定値取得 |
| POST | `/api/settings` | 設定値作成 |
| PATCH | `/api/settings/:provider/:settingType` | 設定値更新 |

### Health

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/health` | ヘルスチェック |

## トラブルシューティング

### データベース接続エラー

**症状:** `Error: Can't reach database server`

**解決策:**
1. DATABASE_URL が正しく設定されているか確認
2. Mac mini のローカル PostgreSQL が起動しているか確認（`pg_isready`）
3. ネットワーク接続を確認

```bash
# 接続テスト
cd apps/api
npx prisma db pull
```

### Redis接続エラー

**症状:** `Error: connect ECONNREFUSED 127.0.0.1:6379`

**解決策:**
1. Redisサーバーが起動しているか確認
2. REDIS_URL が正しく設定されているか確認

```bash
# Redisローカル起動（Docker）
docker run -d -p 6379:6379 redis:alpine

# Redis接続テスト
redis-cli ping
```

### Slack OAuth エラー

**症状:** `Invalid OAuth state`

**解決策:**
1. SLACK_REDIRECT_URI が正しく設定されているか確認
2. Slack App設定でRedirect URLが一致しているか確認
3. ブラウザのキャッシュ・クッキーをクリア

### Webhook署名検証エラー

**症状:** `Invalid signature`

**解決策:**
1. GITHUB_WEBHOOK_SECRET が正しく設定されているか確認
2. GitHubリポジトリのWebhook設定でSecretが一致しているか確認
3. リクエストボディが改変されていないか確認

### 暗号化エラー

**症状:** `Invalid key length`

**解決策:**
1. ENCRYPTION_KEY が32文字以上であることを確認
2. .envファイルが正しく読み込まれているか確認

```bash
# 新しい暗号化キー生成
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## デバッグ手順

### APIデバッグ

```bash
# デバッグモードで起動
cd apps/api
pnpm run start:debug

# VSCodeでデバッグ
# F5キーを押すか、「実行とデバッグ」パネルから起動
```

### ログ確認

```bash
# API ログ（開発環境）
cd apps/api
pnpm run start:dev
# コンソールにログが出力される

# 本番ログ（Mac mini / launchd の StandardOutPath）
tail -f ~/Library/Logs/factrail-api.log
tail -f ~/Library/Logs/factrail-api.error.log
tail -f ~/Library/Logs/factrail-web.log
tail -f ~/Library/Logs/factrail-web.error.log

# デプロイのログ（GitHub Actions）
gh run list --workflow=deploy.yml
gh run view --log
```

> ログは `com.sode.log-rotate`（毎日 04:30）が 50 MiB を超えたものを
> gzip 5 世代でローテートする。古い分は `*.log.1.gz` 〜 `*.log.5.gz`。

### データベース確認

```bash
# Prisma Studio起動
cd apps/api
npx prisma studio
# http://localhost:5555 でブラウザが開く
```

### Redis 確認（認証セッション）

ジョブキューは無い（Bull は 2026-03-22 に廃止済み）。Redis は
`REDIS_SESSION_DB`（既定 1）にセッション類だけを保持する。

```bash
# Redis CLI接続
redis-cli

# セッション関連キーの確認
redis-cli -n 1 --scan --pattern 'session:*'
redis-cli -n 1 --scan --pattern 'user_sessions:*'

# セッションの中身
redis-cli -n 1 GET session:<session-id>
```

## よくある操作

### 新しいモジュール追加

```bash
cd apps/api
nest g module <module-name>
nest g controller <module-name>
nest g service <module-name>
```

### 新しいマイグレーション作成

```bash
cd apps/api
# schema.prisma を編集
npx prisma migrate dev --name <migration_name>
```

### 環境変数の追加

1. `apps/api/.env` に新しい変数を追加
2. `apps/api/.env.example` にも追加（値は空にする）
3. 必要に応じてコードで `process.env.NEW_VAR` を使用

### 新しいページ追加（Next.js）

```bash
cd apps/web/src/app
# ディレクトリ構造でルーティングが決まる
mkdir <page-name>
touch <page-name>/page.tsx
```

### Slack Block Kit メッセージ作成

```typescript
// apps/api/src/dispatchers/slack-dispatcher.service.ts を参考に
const blocks = [
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*タイトル*\n説明文'
    }
  },
  {
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: ':github: GitHub • <URL|リンク>'
      }
    ]
  }
];
```

## 環境変数チェックリスト

### 必須環境変数（apps/api/.env）

- [ ] `DATABASE_URL` - PostgreSQL接続文字列
- [ ] `ENCRYPTION_KEY` - 32文字以上の暗号化キー
- [ ] `SLACK_CLIENT_ID` - Slack アプリのClient ID
- [ ] `SLACK_CLIENT_SECRET` - Slack アプリのClient Secret
- [ ] `SLACK_REDIRECT_URI` - Slack OAuth リダイレクトURI
- [ ] `GITHUB_WEBHOOK_SECRET` - GitHub WebhookのSecret
- [ ] `REDIS_URL` - Redis接続URL

### オプション環境変数

- [ ] `NODE_ENV` - 環境（development/production）
- [ ] `API_PORT` - APIポート番号（デフォルト: 3001）

## パフォーマンスチェック

### データベースクエリ最適化

```bash
# スロークエリ確認（開発環境）
cd apps/api
# prisma.service.ts で $on('query') イベントをログ出力
```

### API レスポンスタイム計測

```bash
# curlでレスポンスタイム計測
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3001/api/facts

# curl-format.txt の内容
# time_total: %{time_total}\n
```

## セキュリティチェックリスト

- [ ] 環境変数が.envファイルに保存され、Gitにコミットされていない
- [ ] トークンが暗号化されてデータベースに保存されている
- [ ] Webhook署名検証が実装されている
- [ ] OAuth state パラメータ検証が実装されている
- [ ] 入力バリデーションが適切に実装されている（class-validator）
- [ ] エラーメッセージに機密情報が含まれていない

## リソース

### ドキュメント
- [Factrail 概要](../docs/Factrail.md)
- [API仕様書](../docs/factrail-API.md)
- [セットアップ手順](../docs/factrail-setup.md)
- [プロジェクトコンテキスト](./context.md)
- [開発ガイドライン](./instructions.md)

### 外部ドキュメント
- [NestJS Documentation](https://docs.nestjs.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Slack API Documentation](https://api.slack.com/)
- [GitHub Webhooks Documentation](https://docs.github.com/webhooks)
- [Chakra UI Documentation](https://chakra-ui.com/docs)
