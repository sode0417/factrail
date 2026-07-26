# factrail プロジェクト指示

factrail は外部イベント (GitHub / Slack / F2A) を Fact (記録) として収集・正規化する NestJS + Next.js モノレポ。本ファイルは Claude Code が毎セッション自動で読み込むプロジェクト固有のガイドラインです。詳細はリンク先を参照してください。

## 言語方針

- **コミット・コメント・ログ・ドキュメント・テスト記述は日本語**
- コード（変数名・関数名・クラス名・型）は英語、ユビキタス言語に従う
- 詳細・ユビキタス言語表: @.claude/instructions.md

## 開発サイクル（Issue ベース 6 Phase v2）

GitHub Issue 起点で **「ドラフト PR で設計レビュー → Ready で実装レビュー」の二段階レビュー**を回す。詳細: @docs/issues/README.md

| Phase | PR 状態 | 主体 | 行うこと | skill |
| --- | --- | --- | --- | --- |
| 0. 要件提起 | — | 人間 | Issue 作成（要件 + 設計サマリー） | — |
| 1. 詳細設計 | **Draft** 作成 | AI 主導 | `docs/issues/<NNN>-<slug>/` 立ち上げ + ドラフト PR | `/start-issue <NNN>` |
| 1.5. 設計レビュー | Draft | AI が反映 | Bot/人間の指摘を `docs(<NNN>): Phase 1 ...` で反映 | — |
| 2. 実装 | Draft のまま | AI | 同 PR に実装コミット | — |
| 3. 検証 | Draft のまま | AI 主導 | test-plan 消化、エビデンス収集 | `/verify-issue <NNN>` |
| **4. PR Open** | **Ready** へ自動 | AI 自動 | 全 PASS なら `gh pr edit --title` → `gh pr ready` の順序で切替 | `/verify-issue` 末尾 |
| 5. FB 集約・マージ | Ready | AI 集約 / 人間がマージ | review.md 集約 + ナレッジ昇華 | `/wrap-issue <NNN>` |

役割分担: GitHub Issue は **人間向け**（要件 + 設計サマリー）。`docs/issues/<NNN>-<slug>/` は **AI 向け**詳細設計（要件展開・シーケンス・テスト・FB ログ）。

軽微な修正（typo・依存更新）はサイクル省略可。AI が省略を提案 → ユーザー承認。

### コミットメッセージ規約 (Issue サイクル内)

- Phase 1: `docs(<NNN>): Phase 1 詳細設計を起こす (<内容>)`
- Phase 1.5: `docs(<NNN>): Phase 1 設計レビュー FB を反映`
- Phase 2: `feat(<NNN>): Phase 2 実装 - <概要>` または `fix(<NNN>): ...`
- Phase 3: `chore(<NNN>): Phase 3 検証エビデンス追加`
- Phase 5: `docs(<NNN>): Phase 5 review.md 集約`

Issue 横断 / ドメイン横断のコミットは `feat(facts)`, `fix(webhooks)` のドメイン scope を使う。詳細は @docs/issues/README.md と @.claude/instructions.md。

### マージ方式

- **Create a merge commit** または **Rebase and merge** を使用
- ❌ **Squash and merge は使わない**（Phase 別 commit が消えるため）

### Bot メンション規約

PR/Issue コメントで **`@claude` を生で書かない**（`claude.yml` workflow の二重 trigger になる）。
代わりに: `` `claude-review` ``、`claude[bot]`、`Bot レビュー` 等のバッククォート囲み・引用形式を使う。
例外: 意図的に Bot を起動したい場合のみ `@claude fix` 等を生で記述。

## コーディング規約

- TypeScript: PascalCase（クラス）/ camelCase（関数・変数）/ UPPER_SNAKE_CASE（定数）
- コメントは日本語で「なぜ」を説明（「何を」は識別子で表現）
- Prettier: セミコロンあり、シングルクォート、行幅 100、trailing comma all
- 詳細: @.claude/instructions.md (コーディング規約・コミット形式・テスト方針)

## Factrail 固有ルール（要点）

### Fact（記録）
- **不変性**: 一度作成された Fact は更新しない（Write Once, Read Many）。修正は新規作成
- **段階的詳細化**: `title` 必須、`summary` → `content` → `raw` の順で詳細化
- **ソーストレーサビリティ**: `source`, `sourceUrl`, `raw` を必ず記録

### Integration（連携）
- アクセストークン・リフレッシュトークンは `EncryptionService` で **必ず暗号化**して DB 保存
- `expiresAt` をチェック、期限切れ前に自動更新。失敗時は `status: inactive` に

### Settings（設定）
- Webhook Secret・API Key は `Settings` テーブルで暗号化管理（環境変数に直接保存しない）

## セキュリティ必須項目

- 入力バリデーション: `class-validator` を使った DTO 単位の検証
- Webhook 署名検証: GitHub `X-Hub-Signature-256` 必須
- OAuth state パラメータ検証
- 暗号化キー (`ENCRYPTION_KEY`) 変更は **全暗号化データが復号不能**になる。変更前に必ずデータエクスポート → 復号 → 新キーで再暗号化の手順を踏む
- レート制限: `@nestjs/throttler`
- エラーメッセージに機密情報を含めない

## アーキテクチャと技術スタック

- API: NestJS + Prisma (`apps/api`)
- Web: Next.js (`apps/web`)
- DB: PostgreSQL（ローカル）/ Supabase（Slack 系では未使用）
- Redis: セッション管理 + OAuth コード保存（**停止不可**）
- Queue: Bull (Slack dispatch は廃止済み、認証用途のみ)
- 詳細: @.claude/context.md

## 環境変数（必須）

`DATABASE_URL`, `ENCRYPTION_KEY` (32 字), `SLACK_CLIENT_ID/SECRET`, `GITHUB_WEBHOOK_SECRET`, `REDIS_URL`, `API_URL`, `NEXT_PUBLIC_F2A_API_URL`

値は `apps/api/.env`, `apps/web/.env.local` を参照（コミット禁止）。

## CI/CD と GitHub 運用

- ワークフロー: `deploy.yml`, `ci-api.yml`, `ci-web.yml`, `test-api.yml`, `test-web.yml`, `security.yml`, `claude-code-review.yml`, `claude.yml`, `claude-task.yml`, `auto-fix.yml`, `auto-label-issues.yml`, `ci-summary.yml`, `ci-failure-issue.yml`, `docs-update-on-merge.yml`
- claude-code-action は `id-token: write` 権限が必須（内部で OIDC → App token 交換）
- **ワークフロー変更時の cherry-pick が必要なのは、claude-code-action を起動する workflow 自身**（`claude-code-review.yml` / `claude.yml` / `claude-task.yml`）**を変更する場合のみ**。検証対象は「その実行を起動した workflow ファイル 1 個」であって `.github/workflows/*` 全体ではない
  - それ以外（`security.yml` / `deploy.yml` / `ci-*.yml` / `test-*.yml` 等）の追加・変更は**通常の PR で問題ない**
  - 実績: PR #160（main に無い workflow を新規追加）、PR #168・#174（`security.yml` / `deploy.yml` を変更）でいずれも claude-review が success
- 詳細: @.claude/instructions.md (PR 作成時の要件)

## デプロイ

- **本番は Mac mini + Cloudflare Tunnel**（Railway / Vercel は 2026-03-15 に廃止）
  - API `factrail-api.sode-ai.com` → :3001 / Web `factrail.sode-ai.com` → :3000
- **経路**: `main` への push（paths フィルタなし・無条件）→ `deploy.yml` → self-hosted runner `mac-mini-factrail`（`~/actions-runner-factrail`, launchd 常駐）→ `scripts/deploy.sh`
  - 手動起動は `gh workflow run deploy.yml -f service=web`（`workflow_dispatch`）
- `scripts/deploy.sh` は `git pull --ff-only` → `pnpm install --frozen-lockfile` → `deploy.json` に従いビルド → **`launchctl kickstart -kp` でサービス再起動** → 4 段ヘルスチェック
  - **プロセスの起動・停止は launchd に委譲している**（自前で `kill` / `nohup` しない）。runner のジョブ終了時 `Cleaning up orphan processes` に起動プロセスが殺されるのを避けるため
  - ⚠️ **Mac mini の作業ツリーは main に置いておくこと**。`git pull --ff-only` するため、feature ブランチのままだとデプロイが落ちる
- **プロセス常駐**: launchd `com.sode.factrail-api` / `com.sode.factrail-web`（KeepAlive + ThrottleInterval 10）
- **ログ**: `~/Library/Logs/factrail-{api,web}{,.error}.log`。`com.sode.log-rotate` が毎日 04:30 に 50 MiB 超を gzip 5 世代でローテート
- **deploy-hook (:3090) は 2026-07-26 に factrail から切り離し済み**（担当は ai-assistant のみ。factrail 向け webhook も無効化）
- パッケージマネージャは **pnpm**（2026-04-05 に npm から移行）。`npm ci` / `npm install` を新規に書かない

## 関連ファイル

- @.claude/instructions.md — コーディング規約・テスト規約・ユビキタス言語表（詳細版）
- @.claude/context.md — アーキテクチャ・データモデル全体図
- @.claude/quickref.md — Prisma・Redis 等のコマンド集
- @docs/issues/README.md — 開発サイクル詳細
- @docs/issues/_template/ — 新規 Issue 用ひな形
