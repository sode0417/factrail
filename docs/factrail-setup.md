---
title: Factrail｜環境構築・運用手順書
type: private
status: Active
date: 2026-08-10
tags: [project, factrail, setup, deploy]
related: [[Factrail（Fact Trail）]]
---

# Factrail 環境構築・運用手順書

> 本ドキュメントは **2026-08-10 に稼働中の実環境を実測して書き起こした**もの。
> 旧版（2025-12・Supabase / Railway 前提）は実態と全面的に乖離していたため破棄した。
>
> **原則: このファイルにコードやスキーマを複製しない。** 実物（`apps/api/prisma/schema.prisma`,
> `deploy.json`, `scripts/deploy.sh`）が唯一の正で、ここは「どこに何があるか」と「なぜそうなっているか」を書く。

---

## 0. 現在の構成（要約）

```
                    Cloudflare Tunnel
  factrail.sode-ai.com     ──→ localhost:3000  (Next.js / apps/web)
  factrail-api.sode-ai.com ──→ localhost:3001  (NestJS  / apps/api)
                                    │
                    ┌───────────────┼───────────────┐
                    ↓               ↓               ↓
            PostgreSQL         Redis          launchd
            localhost:5432     :6379          com.sode.factrail-{api,web}
            db=factrail        認証セッション
            schema=factrail    のみ
```

- **ホスティングは Mac mini 1台**。Railway / Vercel は 2026-03-15 に廃止
- **DB は Mac mini のローカル PostgreSQL**。Supabase は使っていない（§11 参照）
- **ジョブキューは無い**。Bull は 2026-03-22 に廃止（§11 参照）
- **プロセスの起動・停止は launchd に委譲**。自前で `kill` / `nohup` しない

---

## 1. 前提条件

実測値（2026-08-10 時点）:

| 項目 | バージョン | 確認方法 |
|---|---|---|
| Node.js | **24.18.1** | `.node-version` に固定・`node --version` と一致 |
| pnpm | **10.33.0** | `pnpm --version` |
| PostgreSQL | ローカル稼働 | `pg_isready` |
| Redis | ローカル稼働 | `redis-cli ping` |

- パッケージマネージャは **pnpm**（2026-04-05 に npm から移行）。`npm ci` / `npm install` を新規に書かない
- Node は `.node-version` で固定されている。バージョンを上げる時は **ネイティブモジュールの ABI に注意**
  （`better-sqlite3` が Node 25 系でビルドされたまま Node 24 で実行され、`browser` 収集が7日間止まった事故がある。CLAUDE.md「既知のデータ欠損」参照）

その他に必要なもの: GitHub アカウント / Slack ワークスペースの管理権限 / Cloudflare Tunnel の設定権限。

---

## 2. リポジトリと依存関係

```bash
git clone git@github.com:sode0417/factrail.git
cd factrail

# pnpm workspace のためルートで一括。apps/api や apps/web で個別に実行する必要はない
pnpm install
```

モノレポ構成:

```
factrail/
├── apps/
│   ├── api/          # NestJS (:3001)
│   └── web/          # Next.js (:3000)
├── docs/
├── scripts/deploy.sh # デプロイ本体
├── deploy.json       # デプロイ対象サービスの定義
└── .github/workflows/
```

---

## 3. データベース（PostgreSQL）

**Mac mini のローカル PostgreSQL** を使う。接続先は `apps/api/.env` の `DATABASE_URL`:

```
postgresql://<user>:<pass>@localhost:5432/factrail?schema=factrail
```

- データベース名 `factrail`、スキーマ `factrail`（Prisma の `multiSchema` で `factrail` と `public` を扱う）
- テーブル定義を SQL で手書きする必要はない。**スキーマの正は `apps/api/prisma/schema.prisma`**

### マイグレーション

```bash
cd apps/api
npx prisma migrate dev --name <migration_name>   # 開発時: 作成 + 適用
npx prisma migrate deploy                        # 本番相当: 適用のみ
npx prisma generate                              # Prisma Client 再生成
npx prisma studio                                # DB ブラウザ (http://localhost:5555)
```

`apps/api/prisma/migrations/` に履歴がある。`manual/` ディレクトリに手動適用分が置かれている。

⚠️ **`scripts/deploy.sh` には `apply_migrations()` があり、デプロイ時にマイグレーションを適用する。**
DB を壊す変更を含む migration を main に入れる時は、適用タイミングを意識すること。

---

## 4. Redis

**認証セッションと OAuth コードの保存にのみ使う**（`ioredis` 経由）。ジョブキューではない。

- 実使用箇所: `apps/api/src/auth/session/session.service.ts`
- `REDIS_SESSION_DB`（既定 `1`）にセッション類を保持

```bash
redis-cli ping
redis-cli -n 1 --scan --pattern 'session:*'
redis-cli -n 1 --scan --pattern 'user_sessions:*'
```

**停止不可**。落とすとログインできなくなる。

---

## 5. 環境変数

### apps/api/.env

`apps/api/.env.example` をコピーして値を埋める。

```bash
cp apps/api/.env.example apps/api/.env
```

必須のもの:

| 変数 | 用途 |
|---|---|
| `DATABASE_URL` | PostgreSQL 接続文字列 |
| `ENCRYPTION_KEY` | **32文字以上**。トークン暗号化（AES-256-GCM）に使う |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` / `SLACK_REDIRECT_URI` | Slack OAuth |
| `GITHUB_WEBHOOK_SECRET` | GitHub Webhook の署名検証 |
| `REDIS_URL`（または `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`） | Redis 接続 |
| `REDIS_SESSION_DB` | セッション用 DB 番号（既定 1） |
| `JWT_SECRET` | 認証トークン |
| `API_PORT` | 既定 3001 |

⚠️ **`ENCRYPTION_KEY` を変更すると既存の暗号化データが全て復号不能になる。**
変更前に「エクスポート → 復号 → 新キーで再暗号化」の手順を踏むこと。

⚠️ **`.env.example` は実環境より 9 キー少ない**（2026-08-10 実測）。
実際の `.env` にあって example に無いもの:
`ALLOWED_ORIGINS` / `API_KEYS` / `API_URL` / `DIRECT_URL` / `FACTRAIL_USER_ID` /
`GOOGLE_CALENDAR_REFRESH_TOKEN` / `PORT` / `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`
（末尾2つは死んだ設定 → §11）。**新しい環境を立てる時は example だけでは足りない可能性がある。**

### apps/web/.env.local

```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_F2A_API_URL=<F2A の API URL>
```

⚠️ 現在の `apps/web/.env.local` には `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` が残っているが、**死んだ設定**（§11）。

---

## 6. ローカル開発

```bash
# API (:3001)
cd apps/api && pnpm run start:dev

# Web (:3000)
cd apps/web && pnpm run dev
```

アクセス先:

| | URL |
|---|---|
| Web | http://localhost:3000 |
| API | http://localhost:3001 |
| ヘルスチェック | http://localhost:3001/health |
| Prisma Studio | http://localhost:5555 |

### テスト

```bash
cd apps/api
pnpm run test        # ユニット
pnpm run test:e2e    # E2E
pnpm run test:cov    # カバレッジ
```

⚠️ Playwright E2E で `page.waitForLoadState('networkidle')` を使わないこと（flaky になる。Issue #171）。
到達先で必ず描画される要素をロケータで待つ。詳細は `.claude/instructions.md`。

---

## 7. 本番構成（Mac mini）

### 常駐

launchd が2つのサービスを常駐させる（KeepAlive + ThrottleInterval 10）:

| ラベル | plist | ポート |
|---|---|---|
| `com.sode.factrail-api` | `~/Library/LaunchAgents/com.sode.factrail-api.plist` | 3001 |
| `com.sode.factrail-web` | `~/Library/LaunchAgents/com.sode.factrail-web.plist` | 3000 |

ビルド不要で再起動するだけなら:

```bash
launchctl kickstart -k gui/$(id -u)/com.sode.factrail-api
launchctl kickstart -k gui/$(id -u)/com.sode.factrail-web
```

`unload` → `load` ではなく **`kickstart -k`** を使う（旧プロセスが残ることがあるため）。

### 公開

Cloudflare Tunnel（`~/.cloudflared/config.yml`）:

- `factrail.sode-ai.com` → localhost:3000
- `factrail-api.sode-ai.com` → localhost:3001

### ログ

```
~/Library/Logs/factrail-api.log        ~/Library/Logs/factrail-api.error.log
~/Library/Logs/factrail-web.log        ~/Library/Logs/factrail-web.error.log
```

`com.sode.log-rotate` が毎日 04:30 に 50 MiB 超を gzip 5 世代でローテートする。

---

## 8. デプロイ

### 経路

```
main への push（paths フィルタなし・無条件）
  → .github/workflows/deploy.yml
  → self-hosted runner "mac-mini-factrail"（~/actions-runner-factrail・launchd 常駐）
  → scripts/deploy.sh
```

手動起動:

```bash
gh workflow run deploy.yml -f service=web    # service は all / api / web
```

Mac mini 上で直接:

```bash
cd ~/Projects/factrail
./scripts/deploy.sh          # 全サービス
./scripts/deploy.sh api      # API のみ
DEPLOY_SKIP_PULL=1 ./scripts/deploy.sh web   # git pull を省略（リハーサル用）
```

### deploy.sh がやること

`deploy.json` を読み、サービスごとに:

1. `git pull`（`DEPLOY_SKIP_PULL=1` で省略可）
2. `pnpm install`
3. `apply_migrations()` — マイグレーション適用
4. `build_cmd`（`pnpm run build`）
5. **`launchctl kickstart -kp`** でサービス再起動
6. ヘルスチェック（`health_path` に対し `health_expect_jq` で判定・タイムアウトは `health_timeout`）

`deploy.json` の定義:

| service | dir | port | health_path | 判定 |
|---|---|---|---|---|
| `api` | `apps/api` | 3001 | `/health` | `.status == "ok"` |
| `web` | `apps/web` | 3000 | `/` | HTTP 応答 |

### ⚠️ 落とし穴

- **Mac mini の作業ツリーは main に置いておくこと。** `git pull --ff-only` するため、feature ブランチのままだとデプロイが落ちる
- **`deploy.sh` 自身を変更した push では「旧スクリプト」が走る**（runner は `actions/checkout` を使わず、ディスク上の `deploy.sh` をそのまま実行するため。新スクリプトはその中の `git pull` で配置されるだけ）。新しい `deploy.sh` を制御下で初実行するために `workflow_dispatch` の口がある
- **同時デプロイは `concurrency: deploy-factrail` で直列化**されている
- **`/health` が `degraded` を返すと deploy が失敗扱いになる**（`health_expect_jq` が `.status == "ok"` のため）。ヘルスチェックに新しい判定項目を足す時は、デプロイを人質に取らないか検討すること

### workflow 変更時

`.github/workflows/*` のうち **claude-code-action を起動する workflow 自身**
（`claude-code-review.yml` / `claude.yml` / `claude-task.yml`）を変更する場合のみ、
main への cherry-pick が先に必要。それ以外（`deploy.yml` / `ci-*.yml` / `security.yml` 等）は通常の PR でよい。
詳細は CLAUDE.md「CI/CD と GitHub 運用」。

---

## 9. トラブルシューティング

| 症状 | 確認すること |
|---|---|
| `Can't reach database server` | `pg_isready` / `DATABASE_URL` / `cd apps/api && npx prisma db pull` |
| `ECONNREFUSED 127.0.0.1:6379` | `redis-cli ping` / `REDIS_URL` |
| `Invalid OAuth state` | `SLACK_REDIRECT_URI` と Slack App 側の Redirect URL の一致 |
| `Invalid signature`（Webhook） | `GITHUB_WEBHOOK_SECRET` と GitHub 側 Secret の一致 |
| `Invalid key length` | `ENCRYPTION_KEY` が32文字以上か |
| デプロイが落ちる | 作業ツリーが main か / `gh run view --log` |
| サービスが起動しない | `~/Library/Logs/factrail-*.error.log` |

---

## 10. F2A との連携

- **Pull 型**: F2A 側が `GET /api/facts` を呼ぶ
- Fact → F2A Event のマッピングは CLAUDE.md / `.claude/context.md` を参照
- `fact.f2aEventId` に F2A 側の ID が入る（取り込み済みの印）

---

## 11. 廃止済みの構成（残っている設定の説明）

**設定ファイルや環境変数が残っているが、いずれも使われていない。** 削除の判断は別途。

| 廃止したもの | 時期 | 残っているもの |
|---|---|---|
| **Supabase** | 2026-03-15 に Mac mini へ移行 | `apps/api/.env` の `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`、`apps/web/.env.local` の `NEXT_PUBLIC_SUPABASE_*` |
| **Railway** | 同上 | ルートの `railway.json`（NIXPACKS ビルダー定義） |
| **Vercel** | 同上 | なし |
| **Bull（ジョブキュー）** | 2026-03-22（`25bfc57`・Slack dispatch モジュールごと 862 行削除） | なし（依存宣言も 2026-08-09 の PR #194 で削除済み） |

補足:

- **Supabase プロジェクトは既に存在しない。** 2026-08-10 に DNS を確認したところ `NXDOMAIN` で、
  REST API にも到達しない。`SUPABASE_SERVICE_KEY` はプロジェクト消滅により**既に無効**
- **`apps/api/src` に Supabase への参照はゼロ**（旧版ドキュメントが説明していた
  `src/common/supabase/supabase.service.ts` は**実在しない**）
- **Redis は廃止していない。** Bull と一緒に消えたと誤解されやすいが、認証セッションで現役（§4）
