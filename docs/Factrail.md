---
title: Factrail（Fact Trail）
type: private
status: Active
start: 2025-12-29
tags: [project, factrail, log-infrastructure, integration]
related: [[F2A（Fact to Act）]]
---

# Factrail（Fact Trail）

## 🎯 目的（Why）

- 個人の外部・内部活動で発生する **すべての「事実（Fact）」を一元的に収集・正規化・保持する**
- 特定のアプリケーションや UI に依存しない **ログ基盤（インフラ層）** を構築する
- F2A・Obsidian・Slack・AI など、複数のクライアントから **再利用可能な形でログを供給する**

Factrail はアプリケーションではなく、  
**「事実が通過し、痕跡（Trail）として残る基盤」**である。

---

## コンセプト: Fact Trail

Factrail は「Fact（事実）」が  
**時間軸上に Trail（軌跡）として積み重なる**ことを前提に設計される。

- **Fact**: 外部・内部で発生した観測可能な出来事
- **Trail**: 再解釈・再構成・再利用可能な時系列ログ

Factrail 自身は「解釈」や「意思決定」を行わない。  
それらは **F2A や AI クライアントの責務**とする。

---

## 🏁 ゴール（What）

### MVP（2週間）

- GitHub Webhook → PostgreSQL → Slack DM の流れを実装
- OAuth設定用の最小UIを提供（localhost運用）
- F2A連携用のREST APIを公開

### 成果物

- 外部サービス連携を集約する **ログ基盤サービス**
- 正規化された Fact（イベント）を保持・配信できる仕組み
- トークン管理UIとSlack自動投稿機能

### 完了条件

- GitHub の Issue/PR イベントが自動で Slack DM に流れる
- 暗号化されたトークンが安全に管理されている
- F2A から GET /api/facts でデータ取得可能
- 1週間の実運用でログの価値を検証済み

---

## 👤 想定ユーザー（Who）

### 初期フェーズ

- 自分専用（シングルユーザー）
- localhost or Railway 運用

### 将来フェーズ

- 他人も利用可能な SaaS 化
- マルチテナント対応
- F2A 以外のアプリケーションとの連携

---

## 📌 技術スタック

### Backend (API)

- **Framework**: NestJS + TypeScript
- **ORM**: Prisma
- **DB**: PostgreSQL
- **Redis**: 認証セッション / OAuth コード保存（`ioredis`。ジョブキューは 2026-03-22 に廃止済み）
- **暗号化**: crypto (Node.js built-in)

### Frontend (Web)

- **Framework**: Next.js (App Router)
- **UI**: Chakra UI
- **認証**: Basic認証（初期）

### Infrastructure

- **API Deploy**: Railway
- **Web Deploy**: Railway or Vercel
- **DB**: Railway PostgreSQL
- **Redis**: Railway Redis

---

## 📌 管理対象ドメイン（What）

### コアドメイン

#### Facts（事実）
- 外部サービス由来のイベント
- 統一フォーマットへの正規化
- 時系列での保存・検索

#### Integrations（連携）
- OAuth トークン管理（暗号化）
- Webhook エンドポイント
- 同期状態の管理

#### Dispatchers（配信）
- Slack DM への自動投稿
- F2A向け API
- 将来: その他のクライアント

### 外部連携（優先順位）

1. **GitHub**（MVP）
   - Issue / PR / Commit
   - Webhook 受信

2. **Slack**（MVP）
   - OAuth 認証
   - DM への投稿
   - Rate Limit 対応

3. **Google**（将来）
   - Calendar / Todo
   - OAuth 2.0

---

## 🗄 データスキーマ
```prisma
model Fact {
  id          String   @id @default(cuid())
  externalId  String   
  source      String   
  sourceUrl   String?  
  occurredAt  DateTime
  
  title       String   
  summary     String?  
  content     String?  @db.Text
  raw         Json     
  
  type        String   
  metadata    Json?    
  
  // 連携
  slackMessageId String? @unique
  f2aEventId     String? @unique
  
  // 監査
  createdAt   DateTime @default(now())
  processedAt DateTime?
  
  @@unique([source, externalId])
  @@index([occurredAt])
  @@index([type])
  @@index([source])
}

model Integration {
  id            String   @id @default(cuid())
  provider      String   
  accountId     String   
  accountName   String?  
  
  // 暗号化されたトークン
  accessToken   String   @db.Text
  refreshToken  String?  @db.Text
  expiresAt     DateTime?
  scope         String[]
  
  status        String   @default("active")
  lastSyncAt    DateTime?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@unique([provider, accountId])
}
```

---

## 🚫 非スコープ（Not Scope）

- 高度な検索 UI（全文検索、フィルタリング）
- 分析・可視化ダッシュボード
- 通知のカスタマイズ（条件分岐、フィルタ）
- AI による自動要約・分類（Phase 5 以降）
- マルチユーザー管理画面

---

## 🧠 設計上の前提思想

- **Write Once, Read Many**: 一度記録したFactは不変
- **疎結合**: F2Aとは独立して動作可能
- **段階的詳細化**: title → summary → content → raw の順で情報を持つ
- **プライバシー**: トークンは必ず暗号化、Slackには最小限の情報のみ

---

## 🧩 F2A との関係

### データフロー
```
[GitHub] → [Factrail] → [Facts DB]
                ↓              ↓
            [Slack DM]    [F2A Import]
```

### 連携方式

- **Pull型**: F2A が定期的に GET /api/facts を呼ぶ
- **将来**: Webhook で F2A に Push 通知

### スキーママッピング
```typescript
// Fact → F2A Event 変換
{
  fact.title       → event.content
  fact.type        → event.event_type_id (変換テーブル経由)
  fact.metadata    → event.payload
  fact.occurredAt  → event.occurred_at
  fact.id          → event.external_id
}
```

---

## 🗺 実装ロードマップ

### Week 1: 基盤構築

- **Day 1-2**: プロジェクトセットアップ
  - NestJS + Prisma 初期設定
  - PostgreSQL スキーマ作成
  - 暗号化ユーティリティ

- **Day 3-4**: コアAPI実装
  - Facts CRUD
  - Integrations 管理
  - エラーハンドリング

- **Day 5-7**: 最小UI
  - Next.js セットアップ
  - /setup/slack - OAuth画面
  - /setup/github - Webhook設定画面

### Week 2: 外部連携とF2A統合

- **Day 8-10**: Slack連携
  - OAuth フロー実装
  - DM投稿（リアルタイム）
  - Rate Limit 対応（Queue）

- **Day 11-12**: GitHub連携  
  - Webhook 受信・検証
  - Fact 変換ロジック
  - 自動 Slack 投稿

- **Day 13-14**: F2A連携準備
  - GET /api/facts エンドポイント
  - フィルタ・ページネーション
  - F2A形式への変換API

---

## 📊 成功指標

### 技術的指標

- Webhook 受信成功率 > 99%
- Slack 投稿成功率 > 95%
- API レスポンスタイム < 200ms

### 価値指標

- 1日あたり 50+ Facts が自動記録される
- Slack DM を毎日確認する習慣ができる
- F2A でのイベント取り込みが自動化される

---

## 📅 次のアクション

1. Railway プロジェクト作成
2. GitHub リポジトリ作成（factrail）
3. NestJS プロジェクト初期化
4. Prisma スキーマ定義
5. GitHub Webhook エンドポイント実装