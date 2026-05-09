---
name: start-issue
description: |
  GitHub Issue を起点に詳細設計を立ち上げる。Issue 本文を要件として展開し、シーケンス図・テスト計画のひな形を対話で作成する。
  factrail の開発サイクル Phase 1 を担当。
  「/start-issue」「Issue から設計を始める」「<NNN> の設計を立ち上げる」などのリクエスト時に使用。
---

# start-issue スキル

`docs/issues/README.md` の Phase 1（詳細設計）を実行する。Issue 番号を受け取り、`docs/issues/<NNN>-<slug>/` を立ち上げて要件・設計をユーザーと対話で詰める。

## 入力

- Issue 番号 (`<NNN>`)。引数で受け取る。
- 引数省略時は `gh issue list --assignee @me --state open --label project:factrail --limit 20` で開いている Issue を提示し、AskUserQuestion で選択させる。

## Step 1: Issue 取得と slug 提案

```bash
gh issue view <NNN> --json number,title,body,labels,state,url
```

- `state == CLOSED` なら警告し、続行するかユーザー確認。
- タイトルから slug を生成: 全小文字、英数字とハイフンのみ、最大 40 字。
- 同一番号のディレクトリが既にある場合（`docs/issues/<NNN>-*` が存在）はそのディレクトリを使う旨を案内し、上書き確認。
- **slug 候補は 2-3 案を提示してユーザー承認** (AskUserQuestion):
  - 案 1: タイトル前半を採用 (例: `cycle-convention-v2`)
  - 案 2: タイトル末尾を採用 (例: `convention-v2`)
  - 案 3: 簡潔版 (例: `cycle-v2`)
  - **判断基準**: 同種 Issue が複数ある場合は識別性重視、単発なら簡潔さ重視
  - 独断で命名すると後で rename になりやすいので、必ず候補提示する

## Step 2: ディレクトリ立ち上げ

```bash
mkdir -p docs/issues/<NNN>-<slug>/assets
cp docs/issues/_template/{README.md,sequence.md,test-plan.md,review.md} docs/issues/<NNN>-<slug>/
```

## Step 3: README.md を Issue 本文で初期化

- `<NNN>`, `<タイトル>`, `<ISSUE_URL>`, `<type>`, `<slug>` のプレースホルダを動的に置換:
  - `<NNN>`: 引数の Issue 番号
  - `<タイトル>`: `gh issue view` の `title`
  - `<ISSUE_URL>`: `gh issue view <NNN> --json url -q '.url'`（fork・リネーム耐性）
  - `<type>`: Issue ラベル `type:*` から決定（Step 5 参照）
  - `<slug>`: Step 1 で確定した値
- Issue 本文の「概要」「現状の課題」を `## 要件` セクションに転記（要点のみ。長文はリンク参照に留める）。
- `## 受入条件` は Issue から推測した叩き台を入れ、ユーザーに承認を取る。

## Step 4: シーケンス図とテスト計画を対話で叩き台化

### sequence.md

- 影響範囲（API / Web / DB / 外部）を AskUserQuestion で確認。
- 主要フロー（成功系）の Mermaid をドラフト。エラー系・副作用がある場合は別フローを追記。
- ユーザー承認まで反復。

### test-plan.md

- 受入条件 1 つにつき手動シナリオを 1 行以上。
- 自動テストが書けそうな箇所は表に入れる。
- 回帰観点（既存機能影響）を必ず 1 行入れる。

## Step 5: ブランチ作成（オプション、ユーザー確認）

```bash
# 既存ブランチをチェックしてから切る
if git rev-parse --verify "<type>/<NNN>-<slug>" >/dev/null 2>&1; then
  # 既存: AskUserQuestion で「既存に switch / 別 slug で再生成 / スキップ」を確認
  git switch <type>/<NNN>-<slug>
else
  git switch -c <type>/<NNN>-<slug>
fi
```

`<type>` は Issue ラベル `type:*` から決定:
- `type:feature` → `feat`
- `type:bug` → `fix`
- `type:docs` → `docs`
- `type:chore` → `chore`
- 不明なら AskUserQuestion で選択。

ブランチを切らずに既存ブランチで作業する選択肢も提示する。

## Step 6: ブランチを push してドラフト PR を作成

> **プレースホルダ凡例** (本 Step と Step 7 で混在するので明示):
> - `<NNN>` = GitHub **Issue** 番号（引数で受け取る値）
> - `<PR>` = GitHub **PR** 番号（`gh pr create` 後に取得する値）
> - `<slug>` = Step 1 で確定した kebab-case 識別子
> - `<type>` = `feat` / `fix` / `docs` / `chore`（Step 5 参照）

設計ファイル (README.md, sequence.md, test-plan.md, review.md) をコミットしてブランチを push、ドラフト PR を作成する:

```bash
git add docs/issues/<NNN>-<slug>/
git commit -m "docs(<NNN>): Phase 1 詳細設計を起こす (<内容>)"
git push -u origin <type>/<NNN>-<slug>

gh pr create --draft \
  --title "[Phase 1] <Issue title>" \
  --body "<本文 (下記テンプレ参照)>"
```

**PR 本文テンプレート**:

```markdown
## このPRの位置付け

**🎨 Phase 1 (詳細設計) — 設計レビュー待ち / 実装は未着手**

- レビュー対象: `docs/issues/<NNN>-<slug>/` 配下の 4 ファイル
- 実装ファイルはまだ変更していない
- 承認後、Phase 2 で実装コミットを追加 → Phase 3 で検証 → Phase 4 で自動 Ready 切替

## レビュー観点

1. 要件展開の正確性: README.md は Issue #<NNN> の意図と乖離していないか
2. シーケンス: sequence.md は妥当か
3. テスト計画: test-plan.md で漏れはないか
4. スコープ: <Issue から想定>

## 承認の合図

- PR コメントで「LGTM」「approve」「Phase 2 進めて」のいずれか
- またはこのドラフト PR を Ready for review に切り替え

Fixes #<NNN>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

**重要**:
- PR タイトルは `[Phase 1] <Issue title>` の形式（Phase 4 で `[Phase 1]` を除去）
- PR 本文の `@claude` メンションは禁止（claude.yml 二重 trigger 防止）
- Bot に言及するときは `` `claude-review` `` のバッククォート囲みを使う

## Step 7: 設計サマリーを Issue にコメント返し

ドラフト PR 作成後、`docs/issues/<NNN>-<slug>/README.md` の `## 設計サマリー` を抜粋して Issue にコメント:

```bash
gh issue comment <NNN> --body "$(cat <<'EOF'
## 設計サマリー（AI 提案）

`/start-issue <NNN>` を実行し、`docs/issues/<NNN>-<slug>/` に詳細設計を起こしました。

### 採用方針
<README.md の設計サマリー本文>

### ドラフト PR
[PR #<PR>](https://github.com/sode0417/factrail/pull/<PR>) (Draft, [Phase 1] プレフィックス付き)

異論なければ Bot レビュー → ユーザーレビュー → Phase 2 (実装) に進みます。

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

ユーザーが「コメントしないで」と指定した場合はスキップ。

## Step 8: 完了報告

- 作成したファイル一覧 + ドラフト PR 番号
- Phase 1.5 (設計レビュー) でユーザー / Bot 指摘を待つ旨を案内
- 設計差し戻しは `docs(<NNN>): Phase 1 設計レビュー FB を反映` でコミット応答

## 注意点

- `_template/` は変更しない。テンプレ自体の改善が必要なら別 Issue で。
- Issue 本文に書かれた既存の設計サマリーを尊重し、AI が独断で書き換えない。
- ファイル名は kebab-case を厳守。
- `assets/` は空のまま作成する（後続 Phase で使う）。
- `gh pr create --draft` の本文に `@claude` を生で書かない（claude.yml 二重 trigger 防止）。
