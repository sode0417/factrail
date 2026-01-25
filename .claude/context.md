# Factrail - プロジェクトコンテキスト

## プロジェクト概要

Factrailは個人の外部・内部活動で発生する**すべての「事実（Fact）」を一元的に収集・正規化・保持する**ログ基盤（インフラ層）です。

### コアコンセプト

- **Fact（事実）**: 外部・内部で発生した観測可能な出来事
- **Trail（軌跡）**: 再解釈・再構成・再利用可能な時系列ログ
- Factrail自身は「解釈」や「意思決定」を行わず、それらはF2AやAIクライアントの責務

## アーキテクチャ

### モノレポ構成

```
factrail/
├── apps/
│   ├── api/          # NestJS バックエンド
│   └── web/          # Next.js フロントエンド
└── docs/             # プロジェクトドキュメント
```

### 技術スタック

#### Backend (apps/api)
- **Framework**: NestJS + TypeScript
- **ORM**: Prisma
- **DB**: PostgreSQL (multiSchema: factrail, public)
- **Queue**: Bull (Redis)
- **主要機能**:
  - Facts管理（事実の収集・正規化・保存）
  - Integrations管理（OAuth/Webhook）
  - Settings管理（暗号化された設定値）
  - Webhooks受信（GitHub等）

#### Frontend (apps/web)
- **Framework**: Next.js 16 (App Router)
- **UI**: Chakra UI
- **主要機能**:
  - OAuth設定画面
  - Webhook設定画面

#### Infrastructure
- **Deploy**: Railway (API + DB + Redis)
- **Web Deploy**: Railway or Vercel

## データモデル

### Fact（事実）
```typescript
{
  id: string           // UUID
  externalId: string   // 外部サービスのID
  source: string       // "github", "slack", etc.
  sourceUrl?: string   // イベントのURL
  occurredAt: DateTime // 発生日時

  title: string        // 短いタイトル
  summary?: string     // 要約
  content?: string     // 詳細
  raw: Json            // 生データ

  type: string         // イベントタイプ
  metadata?: Json      // 追加メタデータ

  // 連携
  slackMessageId?: string
  f2aEventId?: string

  // 監査
  createdAt: DateTime
  processedAt?: DateTime
}
```

### Integration（連携）
```typescript
{
  id: string
  provider: string      // "github", "slack", "google"
  accountId: string     // 連携アカウントID
  accountName?: string

  // 暗号化されたトークン
  accessToken: string
  refreshToken?: string
  expiresAt?: DateTime
  scope: string[]

  status: string        // "active", "inactive"
  lastSyncAt?: DateTime

  createdAt: DateTime
  updatedAt: DateTime
}
```

### Settings（設定）
```typescript
{
  id: string
  provider: string       // "github", "slack", etc.
  settingType: string   // "webhook_secret", "api_key"
  value: string         // 暗号化された値

  createdAt: DateTime
  updatedAt: DateTime
}
```

## モジュール構成

### apps/api/src/

```
src/
├── common/          # 共通ユーティリティ（暗号化等）
├── facts/           # Factsモジュール
├── integrations/    # Integrationsモジュール
├── settings/        # Settingsモジュール
├── webhooks/        # Webhookモジュール
├── health/          # ヘルスチェック
├── app.module.ts    # ルートモジュール
├── main.ts          # エントリーポイント
└── prisma.service.ts # Prismaサービス
```

## 開発ワークフロー

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
   - Webhook受信

2. **Slack**（MVP）
   - OAuth認証
   - DM投稿
   - Rate Limit対応

3. **Google**（将来）
   - Calendar / Todo
   - OAuth 2.0

## データフロー

```
[GitHub] → [Factrail Webhook] → [Facts DB]
                ↓                     ↓
            [Queue]              [F2A API]
                ↓
            [Slack DM]
```

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

- **Write Once, Read Many**: 一度記録したFactは不変
- **疎結合**: F2Aとは独立して動作可能
- **段階的詳細化**: title → summary → content → raw の順で情報を持つ
- **プライバシー**: トークンは必ず暗号化

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
- 1日あたり50+ Factsが自動記録される
- Slack DMを毎日確認する習慣ができる
- F2Aでのイベント取り込みが自動化される

## リポジトリ情報

- **Main branch**: main
- **Git Status**: 通常はmainブランチで開発
- **Railway**: apps/apiをデプロイ
- **Vercel**: apps/webをデプロイ予定
