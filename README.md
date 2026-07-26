# Factrail

**個人活動のすべての「記録（Fact）」を一元管理するログ基盤**

Factrailは、GitHub、Slack、Googleなど外部サービスで発生するイベントを収集・正規化し、時系列のログ（Trail）として保存するインフラ層です。特定のアプリケーションに依存せず、F2AやObsidian、AIクライアントなど、複数のクライアントから再利用可能な形でデータを提供します。

---

## 🎯 コンセプト

- **Fact（記録）**: 外部・内部で発生した観測可能な出来事
- **Trail（軌跡）**: 再解釈・再構成・再利用可能な時系列ログ
- Factrail自身は「解釈」や「意思決定」を行わず、それらはクライアント（F2A、AI等）の責務とする

---

## 📌 技術スタック

### Backend (apps/api)
- **Framework**: NestJS + TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL (Supabase)
- **Queue**: Bull (Redis)
- **主要機能**: Facts管理、Integrations管理、Webhook受信、Slack DM/チャンネル自動投稿

### Frontend (apps/web)
- **Framework**: Next.js 16 (App Router)
- **UI**: Chakra UI
- **主要機能**: OAuth設定画面、Webhook設定画面

### Infrastructure
- **Hosting**: Mac mini（自宅サーバ）+ Cloudflare Tunnel
  - API: `https://factrail-api.sode-ai.com`（内部 :3001）
  - Web: `https://factrail.sode-ai.com`（内部 :3000）
- **Deploy**: GitHub Actions（self-hosted runner）→ `scripts/deploy.sh` → launchd
- **Database**: Supabase (PostgreSQL・F2Aと共有)
- **Queue/Session**: Redis (Homebrew, :6379)

> Railway / Vercel は 2026-03-15 に廃止し、Mac mini へ全面移行しました。

---

## 🚀 セットアップ

### 前提条件

- Node.js 20.9+（CI は 20 系、Mac mini は 25 系で稼働）
- pnpm 10+
- Supabaseプロジェクト
- Redis (ローカル開発: Docker)

### 1. リポジトリクローン

```bash
git clone https://github.com/yourusername/factrail.git
cd factrail
```

### 2. 依存関係インストール

pnpm workspace のため、**リポジトリルートで一括インストール**します
（`apps/api` / `apps/web` で個別に実行する必要はありません）。

```bash
pnpm install
```

### 3. 環境変数設定

```bash
# API: apps/api/.env
cp apps/api/.env.example apps/api/.env
# .envファイルを編集し、必要な値を設定

# Web: apps/web/.env.local
# 必要に応じて設定
```

主な環境変数：
```env
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_SERVICE_KEY=...
ENCRYPTION_KEY=... # 32文字のランダム文字列
REDIS_URL=redis://localhost:6379
```

### 4. データベースセットアップ

詳細は[セットアップ手順書](docs/factrail-setup.md)を参照

```bash
cd apps/api

# Prisma Client生成
npx prisma generate

# データベース確認
npx prisma studio
```

### 5. 開発サーバー起動

```bash
# Redisをローカルで起動（Dockerを使用）
docker run -d -p 6379:6379 redis:alpine

# APIサーバー起動
cd apps/api
pnpm run start:dev

# Webサーバー起動（別ターミナル）
cd apps/web
pnpm run dev
```

アクセス:
- API: http://localhost:3001
- Web: http://localhost:3000
- Prisma Studio: http://localhost:5555

---

## 🚢 デプロイ

本番は Mac mini 上で稼働し、GitHub Actions の self-hosted runner が自動デプロイします。

```
main へ push
  └→ .github/workflows/deploy.yml（paths フィルタなし・無条件発火）
      └→ self-hosted runner: mac-mini-factrail（launchd 常駐）
          └→ scripts/deploy.sh
              ├─ git pull origin main --ff-only
              ├─ pnpm install --frozen-lockfile（ルートで workspace 一括）
              └─ deploy.json をループ
                  ├─ ビルド（pnpm run build）
                  ├─ launchctl kickstart -kp でサービス再起動
                  └─ 4 段ヘルスチェック（PID / クラッシュループ / 系統 / HTTP）
```

**プロセスの起動・停止は launchd に委譲**しています（自前で `kill` / `nohup` しない）。
runner のジョブ終了処理 `Cleaning up orphan processes` に起動プロセスが殺されるのを避けるためです。

```bash
# 手動デプロイ（Mac mini 上）
./scripts/deploy.sh          # 全サービス
./scripts/deploy.sh api      # API のみ

# GitHub から手動トリガー
gh workflow run deploy.yml -f service=web

# ビルド不要でサービス再起動だけ
launchctl kickstart -k gui/$(id -u)/com.sode.factrail-api
```

> ⚠️ Mac mini の作業ツリーは **main に置いておくこと**。`deploy.sh` が
> `git pull --ff-only` するため、feature ブランチのままだとデプロイが落ちます。

ログは `~/Library/Logs/factrail-{api,web}{,.error}.log`。
`com.sode.log-rotate` が毎日 04:30 に 50 MiB 超を gzip 5 世代でローテートします。

---

## 📖 ドキュメント

### 概要・仕様
- [プロジェクト概要](docs/Factrail.md)
- [API仕様書](docs/factrail-API.md)
- [セットアップ手順](docs/factrail-setup.md)

### 開発者向け
- [プロジェクトコンテキスト（最新の実装状況）](.claude/context.md)
- [クイックリファレンス（コマンド・トラブルシューティング）](.claude/quickref.md)
- [開発ガイドライン](.claude/instructions.md)
- [Branch Protection Rules 設定ガイド](docs/branch-protection-setup.md)

---

## 🤖 ClaudeCodeでの開発

このプロジェクトはClaudeCodeによる自動開発をサポートしています。

### Issue作成から実装まで

1. **Issueを作成**
   - GitHubで「開発タスク」テンプレートを使用
   - `claude:auto`ラベルが自動付与される

2. **Claudeが自動応答**
   - 実装方針を提案
   - 詳細なタスクリストを作成

3. **対話で調整**
   - 不明点を確認
   - タスクリストを承認

4. **Claudeをアサイン**
   - Claudeが実装を開始
   - 完了後、PRを自動作成

5. **レビュー・マージ**
   - PR本文には日本語で実装内容、エビデンス、動作確認手順が記載される

### ローカルでのClaudeCode使用

```bash
# ClaudeCodeをインストール（グローバルインストールは npm を使う）
npm install -g @anthropic-ai/claude-code

# プロジェクトディレクトリで実行
claude-code
```

---

## 🗂 プロジェクト構造

```
factrail/
├── apps/
│   ├── api/                      # NestJS Backend
│   │   ├── src/
│   │   │   ├── facts/            # Factsモジュール
│   │   │   ├── integrations/    # 外部連携管理
│   │   │   ├── settings/         # 設定管理
│   │   │   ├── webhooks/         # Webhook受信
│   │   │   ├── common/           # 共通ユーティリティ
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── package.json
│   └── web/                      # Next.js Frontend
│       ├── app/
│       └── package.json
├── docs/                         # ドキュメント
├── .claude/                      # ClaudeCode設定
│   ├── context.md               # プロジェクトコンテキスト
│   ├── instructions.md          # 開発ガイドライン
│   └── settings.local.json      # ローカル設定（gitignore）
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── development.yml      # 開発タスクテンプレート
│   ├── workflows/
│   │   ├── deploy.yml           # main push → self-hosted runner でデプロイ
│   │   ├── ci-api.yml / ci-web.yml
│   │   ├── test-api.yml / test-web.yml
│   │   ├── security.yml         # pnpm audit / Snyk / Trivy
│   │   ├── claude.yml           # Claude自動応答
│   │   ├── claude-code-review.yml
│   │   └── ...                  # auto-fix, ci-summary, ci-failure-issue 等
│   ├── dependabot.yml           # 依存の自動更新（土曜 06:00 JST）
│   └── pull_request_template.md
└── README.md
```

---

## 🔑 主要機能

### Facts（記録）管理
- 外部イベントの収集・正規化
- 時系列保存・検索
- カーソルベースページネーション

### Integrations（連携）管理
- OAuth認証フロー
- トークン暗号化保存
- 自動リフレッシュ

### Webhook受信
- GitHub Webhook対応
- 署名検証
- 非同期処理（Bull Queue）

### F2A連携
- Facts → F2A Events 変換API
- Pull型データ取得
- インポート済みフラグ管理

---

## 🧪 テスト

```bash
# ユニットテスト（リポジトリルートから）
pnpm --filter api test

# E2Eテスト（Playwright / apps/web）
pnpm --filter web test:e2e

# カバレッジ
pnpm --filter api test:cov
```

---

## 🛡️ セキュリティ

### セキュリティスキャン

このプロジェクトでは、複数のセキュリティツールを使用して依存関係とコードの脆弱性を自動的にスキャンしています。

#### 自動実行

以下のタイミングでセキュリティスキャンが自動実行されます：
- Pull Request作成時
- mainブランチへのpush時
- 毎週日曜日午前0時（UTC）

#### 使用ツール

1. **pnpm audit** - 依存関係の脆弱性チェック
2. **Snyk** - 依存関係とコードの脆弱性スキャン
3. **Trivy** - ファイルシステムとIaC設定のスキャン

#### ローカルでのセキュリティチェック

```bash
# 依存の脆弱性チェック（CI の pnpm-audit ジョブと同じ）
pnpm audit --prod --audit-level high

# Snykを実行（事前にSnyk CLIのインストールと認証が必要）
cd apps/api
npx snyk test --severity-threshold=high

# Trivyを実行（事前にTrivyのインストールが必要）
trivy fs --severity HIGH,CRITICAL .
```

#### Snykのセットアップ（リポジトリ管理者向け）

1. [Snyk](https://snyk.io/)でアカウントを作成
2. GitHubリポジトリと連携
3. Snyk APIトークンを取得
4. GitHubリポジトリのSettings > Secrets > Actionsで `SNYK_TOKEN` を設定

#### セキュリティポリシー

- 高（HIGH）または致命的（CRITICAL）な脆弱性が検出された場合、CIは失敗します
- 脆弱性レポートはGitHub Actions Artifactsとして30日間保存されます
- SARIF形式のレポートはGitHub Securityタブで確認できます

---

## 📊 データモデル

### Fact（記録）

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
  slackMessageId?: string
  f2aEventId?: string
  createdAt: DateTime
  processedAt?: DateTime
}
```

### Integration（連携）

```typescript
{
  id: string
  provider: string      // "github", "slack", "google"
  accountId: string
  accountName?: string
  accessToken: string   // 暗号化済み
  refreshToken?: string // 暗号化済み
  expiresAt?: DateTime
  scope: string[]
  status: string        // "active", "inactive"
  lastSyncAt?: DateTime
  createdAt: DateTime
  updatedAt: DateTime
}
```

**重要**: トークンは必ず暗号化して保存すること（ユビキタス言語参照）

---

## 🛣 ロードマップ

### Phase 1: MVP（完了予定: 2週間）
- [x] プロジェクトセットアップ
- [x] Facts/Integrations CRUD
- [x] GitHub Webhook受信
- [x] Slack連携（OAuth認証、DM/チャンネル自動投稿）
- [x] F2A連携API（Facts取得、変換API）

### Phase 2: 機能拡張
- [ ] Google Calendar連携
- [ ] 検索・フィルタリング強化
- [ ] WebSocket対応

### Phase 3: 高度化
- [ ] AI要約・分類
- [ ] 可視化ダッシュボード
- [ ] マルチテナント対応

---

## 🤝 コントリビューション

1. Issueを作成（「開発タスク」テンプレート使用）
2. Claudeが方針を提案
3. ブランチを作成
4. 実装・テスト
5. PRを作成（日本語テンプレート使用）
6. レビュー・マージ

---

## 📄 ライセンス

MIT

---

## 📧 連絡先

プロジェクトに関する質問や提案は、GitHubのIssueで受け付けています。

---

**Built with ❤️ using ClaudeCode**
