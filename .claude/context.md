# Factrail - プロジェクトコンテキスト

## プロジェクト概要

Factrailは個人の外部・内部活動で発生する**すべての「記録（Fact）」を一元的に収集・正規化・保持する**ログ基盤（インフラ層）です。

### コアコンセプト

- **Fact（記録）**: 外部・内部で発生した観測可能な出来事
- **Trail（軌跡）**: 再解釈・再構成・再利用可能な時系列ログ
- Factrail自身は「解釈」や「意思決定」を行わず、それらはF2A、Obsidian、AIクライアントなどの責務

## アーキテクチャ

### モノレポ構成

```
factrail/
├── apps/
│   ├── api/          # NestJS バックエンド
│   └── web/          # Next.js フロントエンド
├── docs/             # プロジェクトドキュメント
├── .claude/          # Claude Code設定・コンテキスト
└── .github/          # GitHub設定・ワークフロー
```

### 技術スタック

#### Backend (apps/api)
- **Framework**: NestJS 10.0.0 + TypeScript 5.1.3
- **ORM**: Prisma 6.19.1
- **DB**: PostgreSQL (Supabase) - multiSchema: factrail, public
- **Queue**: Bull 4.16.5 (Redis)
- **Slack連携**: @slack/web-api 7.13.0
- **バリデーション**: class-validator 0.14.3, class-transformer 0.5.1
- **主要機能**:
  - Facts管理（記録の収集・正規化・保存）
  - Integrations管理（OAuth/Webhook）
  - Settings管理（暗号化された設定値）
  - Webhooks受信・検証（GitHub等）
  - Dispatchers（Slack DM/チャンネル自動投稿）

#### Frontend (apps/web)
- **Framework**: Next.js 16.1.1 (App Router) + React 19.2.3
- **UI**: Chakra UI 2.10.9
- **HTTP**: axios 1.13.2
- **アニメーション**: framer-motion 12.25.0
- **主要機能**:
  - OAuth設定画面（GitHub/Slack）
  - OAuth コールバック処理
  - Fact一覧表示
  - アクティビティビュー

#### Infrastructure
- **Database**: Supabase (PostgreSQL)
- **API Deploy**: Railway
- **Web Deploy**: Vercel
- **Queue**: Redis (Bull)

## データモデル

### Fact（記録）
```typescript
{
  id: string           // UUID
  externalId: string   // 外部サービスのID
  source: string       // "github", "slack", etc.
  sourceUrl?: string   // イベントのURL
  occurredAt: DateTime // 発生日時（インデックス）

  title: string        // 短いタイトル
  summary?: string     // 要約
  content?: string     // 詳細
  raw: Json            // 生データ

  type: string         // イベントタイプ（インデックス）
  metadata?: Json      // 追加メタデータ

  // 連携
  slackMessageId?: string  // Slack投稿のメッセージID（一意）
  f2aEventId?: string      // F2A連携用イベントID（一意）

  // 監査
  createdAt: DateTime
  processedAt?: DateTime

  // 制約
  Unique: [source, externalId]
  Indexes: occurredAt, type, source, f2aEventId
}
```

### Integration（連携）
```typescript
{
  id: string
  provider: string      // "github", "slack", "google"
  accountId: string     // 連携アカウントID
  accountName?: string

  // 暗号化されたトークン（AES-256-GCM）
  accessToken: string
  refreshToken?: string
  expiresAt?: DateTime
  scope: string[]

  status: string        // "active", "inactive"
  lastSyncAt?: DateTime

  createdAt: DateTime
  updatedAt: DateTime

  // 制約
  Unique: [provider, accountId]
}
```

### Settings（設定）
```typescript
{
  id: string
  provider: string       // "github", "slack", etc.
  settingType: string   // "webhook_secret", "api_key", "target_channel_id"
  value: string         // 暗号化された値

  createdAt: DateTime
  updatedAt: DateTime

  // 制約
  Unique: [provider, settingType]
}
```

## モジュール構成

### apps/api/src/

```
src/
├── common/
│   └── crypto/              # 暗号化/復号化ユーティリティ（AES-256-GCM）
├── facts/                   # Factsモジュール
│   ├── facts.service.ts     # CRUD操作、カーソルベースページネーション
│   ├── facts.controller.ts  # REST APIエンドポイント
│   └── dto/                 # 入出力スキーマ定義
├── integrations/            # Integrationsモジュール
│   ├── integrations.service.ts  # 連携管理
│   ├── slack-oauth.service.ts   # Slack OAuth認証フロー
│   └── dto/                     # CreateIntegrationDto, UpdateIntegrationDto
├── settings/                # Settingsモジュール
│   └── settings.service.ts  # 設定値の暗号化保存・復号化取得
├── webhooks/                # Webhookモジュール
│   ├── webhooks.service.ts      # GitHub Webhook検証・処理
│   ├── webhooks.controller.ts   # Webhook受信エンドポイント
│   └── webhooks.module.ts       # モジュール定義
├── dispatchers/             # Dispatchersモジュール
│   ├── slack-dispatcher.service.ts     # Slack DM/チャンネル投稿
│   ├── slack-dispatcher.processor.ts   # Bull キュー処理（リトライロジック）
│   └── dto/                            # DispatchSlackMessageDto
├── health/                  # ヘルスチェック
├── app.module.ts            # ルートモジュール
├── main.ts                  # エントリーポイント
└── prisma.service.ts        # Prismaサービス
```

### apps/web/src/

```
src/
├── app/
│   ├── page.tsx              # ホームページ
│   ├── layout.tsx            # ルートレイアウト
│   ├── providers.tsx         # Chakra UIプロバイダー
│   ├── setup/
│   │   ├── github/page.tsx           # GitHub OAuth設定画面
│   │   └── slack/
│   │       ├── page.tsx              # Slack OAuth設定画面
│   │       └── callback/page.tsx     # Slack OAuth コールバック処理
│   ├── facts/page.tsx        # Fact一覧表示
│   └── activity/page.tsx     # アクティビティビュー
├── components/
│   └── layout/
│       ├── Header.tsx        # ナビゲーションヘッダー
│       ├── Sidebar.tsx       # サイドバーナビゲーション
│       └── MainLayout.tsx    # レイアウトテンプレート
└── utils/
    └── oauth.ts              # OAuth関連ユーティリティ（state管理）
```

## セキュリティ実装

### トークン暗号化
- **アルゴリズム**: AES-256-GCM
- **対象**: accessToken, refreshToken, webhook secrets
- **鍵管理**: 環境変数 `ENCRYPTION_KEY`（32文字以上）

### Webhook検証
- **HMAC署名検証**: GitHub Webhook の `X-Hub-Signature-256` ヘッダー
- **Timing-safe比較**: タイミング攻撃対策

### OAuth 2.0フロー
- **CSRF保護**: OAuth state パラメータ検証
- **Slack/GitHub統合**: 標準的なOAuth 2.0フロー実装

## 非同期処理

### Bull Queue
- **用途**: Slack DM/チャンネル投稿の非同期処理
- **リトライロジック**: 指数バックオフで最大5回
- **Processor Pattern**: ジョブ処理の分離

### データフロー

```
[GitHub] → [Factrail Webhook] → [Facts DB]
                ↓                     ↓
          [Bull Queue]          [F2A API]
                ↓
          [Slack DM/Channel]
```

## 開発ワークフロー

### 環境変数設定

```bash
# apps/api/.env
NODE_ENV=development
API_PORT=3001

# データベース
DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?schema=factrail&pgbouncer=true

# Supabase
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SERVICE_KEY=YOUR_SERVICE_ROLE_KEY

# セキュリティ
ENCRYPTION_KEY=CHANGE_ME_32_CHARS_MINIMUM

# Slack OAuth
SLACK_CLIENT_ID=YOUR_SLACK_CLIENT_ID
SLACK_CLIENT_SECRET=YOUR_SLACK_CLIENT_SECRET
SLACK_REDIRECT_URI=http://localhost:3000/setup/slack/callback

# GitHub
GITHUB_WEBHOOK_SECRET=YOUR_GITHUB_WEBHOOK_SECRET

# Redis
REDIS_URL=redis://localhost:6379
```

### 開発サーバー起動

```bash
# API
cd apps/api
npm run start:dev

# Web
cd apps/web
npm run dev
```

### データベース

```bash
# マイグレーション生成
cd apps/api
npx prisma migrate dev --name <migration_name>

# スキーマ同期
npx prisma db push

# Prisma Studio起動
npx prisma studio
```

### テスト

```bash
# ユニットテスト
npm run test

# E2Eテスト
npm run test:e2e

# カバレッジ
npm run test:cov
```

## 外部連携

### 優先順位

1. **GitHub**（MVP）
   - Issue / PR / Commit
   - Webhook受信・HMAC検証
   - Fact への正規化

2. **Slack**（MVP）
   - OAuth認証（Bot Token + User Token）
   - DM/チャンネル自動投稿
   - Block Kit メッセージフォーマット
   - Rate Limit対応
   - 絵文字マッピング（ソース別）

3. **Google**（将来）
   - Calendar / Todo
   - OAuth 2.0

## F2Aとの関係

### 連携方式
- **Pull型**: F2AがGET /api/factsを呼ぶ
- **将来**: Webhook Push通知

### スキーママッピング
```typescript
// Fact → F2A Event 変換
{
  fact.title       → event.content
  fact.type        → event.event_type_id
  fact.metadata    → event.payload
  fact.occurredAt  → event.occurred_at
  fact.id          → event.external_id
}
```

## 設計原則

- **Write Once, Read Many**: 一度作成した記録は不変
- **疎結合**: F2Aとは独立して動作可能
- **段階的詳細化**: title → summary → content → raw の順で情報を持つ
- **プライバシー**: トークンは必ず暗号化（AES-256-GCM）
- **べき等性**: 同じイベントの重複処理を防ぐ（unique制約: [source, externalId]）

## ページネーション

### カーソルベース
- **方式**: Offset-based ではなく cursor-based pagination
- **効率性**: limit + 1 取得で次ページ判定
- **並び順**: occurredAt DESC（最新のFactから）

## 非スコープ

以下は現在のスコープ外：
- 高度な検索UI
- 分析・可視化ダッシュボード
- 通知のカスタマイズ
- AIによる自動要約・分類
- マルチユーザー管理

## 成功指標

### 技術的指標
- Webhook受信成功率 > 99%
- Slack投稿成功率 > 95%
- APIレスポンスタイム < 200ms

### 価値指標
- 1日あたり50+件の記録が自動で蓄積される
- Slack DMを毎日確認する習慣ができる
- F2Aでのイベント取り込みが自動化される

## 開発規約

### 言語規約
- **コード**: 英語（変数名、関数名、クラス名）
- **コメント**: 日本語（JSDoc、インラインコメント）
- **ログ**: 日本語
- **ドキュメント**: 日本語
- **コミットメッセージ**: 日本語

### ClaudeCode統合
- GitHub Issue テンプレート使用
- `claude:auto` ラベルで自動応答
- Issue → PR 自動フロー対応

## リポジトリ情報

- **Main branch**: main
- **Current branch**: claude/issue-4-slack-dm-dispatch
- **最新機能**: Slack DM/チャンネル自動投稿機能の実装完了
- **Railway**: apps/api をデプロイ
- **Vercel**: apps/web をデプロイ予定

## 主要ファイルパス

| ファイル | パス |
|---------|------|
| API Schema | `apps/api/prisma/schema.prisma` |
| API Main | `apps/api/src/main.ts` |
| API Module | `apps/api/src/app.module.ts` |
| Web Home | `apps/web/src/app/page.tsx` |
| Web Layout | `apps/web/src/app/layout.tsx` |
| Slack OAuth | `apps/web/src/app/setup/slack/page.tsx` |
| GitHub OAuth | `apps/web/src/app/setup/github/page.tsx` |
