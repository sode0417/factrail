---
name: verify-issue
description: |
  実装後の検証フェーズで test-plan.md を順に消化し、全 PASS なら PR を Ready 切替まで自動で進める。
  factrail の開発サイクル Phase 3 (検証) と Phase 4 (PR Open) を担当。
  「/verify-issue」「検証を始める」「<NNN> の動作確認」などのリクエスト時に使用。
---

# verify-issue スキル

`docs/issues/README.md` の Phase 3（検証）と Phase 4（PR Ready 切替）を実行する。Issue 番号を受け取り、`docs/issues/<NNN>-<slug>/test-plan.md` のチェックリストを順に消化し、全 PASS なら自動でドラフト PR を Ready に切り替える。

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
3. ユーザーに操作してもらうか、Playwright MCP が使えるなら自動化（判定: `mcp__playwright_*__browser_*` ツールが利用可能な状態かを最初に確認。なければユーザーに手動操作を依頼）
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

## Step 7: Phase 4 自動 Ready 切替（条件付き）

test-plan.md の未チェック項目数を確認し、**全 PASS の場合のみ**自動で PR を Ready に切替:

```bash
# 未チェック数を count (set -e 環境で grep が 0 hit でも止まらないよう || true)
unchecked=$(grep -c '^- \[ \]' docs/issues/<NNN>-<slug>/test-plan.md || true)

# 関連 PR を取得 (-q で記法統一)
PR=$(gh pr list --head "$(git branch --show-current)" --json number -q '.[0].number')

# PR 未存在時の guard (まだ push 前など)
if [ -z "$PR" ]; then
  echo "⚠️ 現在のブランチに紐付く PR が見つかりません。"
  echo "   /start-issue でブランチ + ドラフト PR を作成してから再実行してください。"
  exit 0
fi

title=$(gh pr view "$PR" --json title -q '.title')

if [ "$unchecked" = "0" ]; then
  # ★ 順序が重要: タイトル更新 → Ready 切替
  # ready_for_review イベント発火時点でタイトル更新済 → claude-review が通常 prompt で起動
  new_title=$(echo "$title" | sed 's/^\[Phase 1\] //')
  gh pr edit "$PR" --title "$new_title"
  gh pr ready "$PR"
  echo "✅ PR #$PR を Ready に切替しました (Phase 4 完了)"
else
  echo "⚠️ test-plan に未チェック項目が $unchecked 件あります。Draft 維持。"
  echo "   保留理由を review.md に記録するか、追加検証を実施してください。"
fi
```

**Ready 切替しないケース**:
- test-plan に未チェックの `- [ ]` が残っている
- 自動テストで failure があった
- 手動検証で NG / 保留があった

これらの場合は Draft 維持し、`review.md` または PR コメントに保留理由を記録。**AI は「軽微だから OK」と勝手に Ready 切替しない**。

## 注意点

- `test-plan.md` の項目が網羅的でない場合、検証中に気付いたら追加し、設計と整合させる。
- スクショは Playwright MCP で取れるが、ルート直下に置かない（`.gitignore` で `/*.png` は除外済み）。必ず `docs/issues/<NNN>-<slug>/assets/` 配下へ。
- 失敗時に独断でコードを直さない。Phase 2 に戻すかユーザーに判断を委ねる。
- Ready 切替時、タイトルから `[Phase 1]` プレフィックスを除去する処理を順序通りに実行（タイトル更新 → `gh pr ready`）。逆だと空コミットが必要になる。
