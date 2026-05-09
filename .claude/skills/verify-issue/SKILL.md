---
name: verify-issue
description: |
  実装後の検証フェーズで test-plan.md を順に消化する。手動シナリオの確認、自動テストの実行、エビデンス収集を構造化して進める。
  factrail の開発サイクル Phase 3 を担当。
  「/verify-issue」「検証を始める」「<NNN> の動作確認」などのリクエスト時に使用。
---

# verify-issue スキル

`docs/issues/README.md` の Phase 3（検証）を実行する。Issue 番号を受け取り、`docs/issues/<NNN>-<slug>/test-plan.md` のチェックリストを順に消化する。

## 入力

- Issue 番号 (`<NNN>`)。省略時は現在のブランチ名 (`<type>/<NNN>-<slug>`) から推測。
- 推測できない場合は AskUserQuestion で対象を選択。

## Step 1: 対象ディレクトリと test-plan.md の確認

```bash
ls docs/issues/<NNN>-*/
```

- 該当ディレクトリが無い場合は `/start-issue` を先に実行するよう案内して終了。
- `test-plan.md` が空（チェック項目なし）の場合は、設計を先に詰めるよう案内。

## Step 2: 自動テストの実行

`test-plan.md` の「自動テスト」表に書かれたものを実行:

```bash
# api
cd apps/api && npm run test -- <対象>

# web
cd apps/web && npm run test -- <対象>
```

結果を要約。失敗があれば該当箇所を提示し、修正は Phase 2 に戻ってから行う。

## Step 3: 手動検証シナリオを順に消化

`test-plan.md` の「手動検証」リストを 1 つずつ:

1. シナリオを声に出してユーザーに読み上げ（実施手順を明確化）
2. 必要なローカル環境を起動（factrail のローカルデプロイは launchd 管理 → `deploy_local.md` 参照）
3. ユーザーに操作してもらうか、Playwright MCP が使えるなら自動化
4. エビデンス（スクショ）を `docs/issues/<NNN>-<slug>/assets/` に保存
   - ファイル名: `verify-<シナリオ番号>-<短いラベル>.png` （例: `verify-01-login-success.png`）
5. AskUserQuestion で「OK / NG / 保留」を確認
6. `test-plan.md` のチェックボックスを更新

## Step 4: 非機能・回帰チェック

- 既存の主要画面が表示されることを確認（最低 2-3 画面）
- console エラーが出ていないか
- 認証エラー時の挙動

## Step 5: エビデンス表の更新

`test-plan.md` の「検証エビデンス」表に、シナリオごとの assets パスを記入。

## Step 6: 検証結果サマリー

- ✅ 通過したシナリオ数 / 全体
- ❌ 失敗したシナリオと再現手順
- ⚠️ 保留・確認が必要な項目

すべて ✅ なら Phase 4 (PR 作成) へ進める旨を提示。

## 注意点

- `test-plan.md` の項目が網羅的でない場合、検証中に気付いたら追加し、設計と整合させる。
- スクショは Playwright MCP で取れるが、ルート直下に置かない（`.gitignore` で `/*.png` は除外済み）。必ず `docs/issues/<NNN>-<slug>/assets/` 配下へ。
- 失敗時に独断でコードを直さない。Phase 2 に戻すかユーザーに判断を委ねる。
