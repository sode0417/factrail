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
- AskUserQuestion で slug 案を提示してユーザー承認。

## Step 2: ディレクトリ立ち上げ

```bash
mkdir -p docs/issues/<NNN>-<slug>/assets
cp docs/issues/_template/{README.md,sequence.md,test-plan.md,review.md} docs/issues/<NNN>-<slug>/
```

## Step 3: README.md を Issue 本文で初期化

- `<NNN>`, `<タイトル>`, Issue URL, ブランチ名予定 (`<type>/<NNN>-<slug>`) を埋める。
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
git checkout -b <type>/<NNN>-<slug>
```

`<type>` は Issue ラベル `type:*` から決定:
- `type:feature` → `feat`
- `type:bug` → `fix`
- `type:docs` → `docs`
- `type:chore` → `chore`
- 不明なら AskUserQuestion で選択。

ブランチを切らずに既存ブランチで作業する選択肢も提示する。

## Step 6: 設計サマリーを Issue にコメント返し

完了直前に、`docs/issues/<NNN>-<slug>/README.md` の `## 設計サマリー` を抜粋して Issue にコメント:

```bash
gh issue comment <NNN> --body "$(cat <<'EOF'
## 設計サマリー（AI 提案）

<README.md の設計サマリー本文>

詳細: docs/issues/<NNN>-<slug>/

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

ユーザーが「コメントしないで」と指定した場合はスキップ。

## Step 7: 完了報告

- 作成したファイル一覧
- 次のアクション（Phase 2 実装、または設計の追加詰め）を提示

## 注意点

- `_template/` は変更しない。テンプレ自体の改善が必要なら別 Issue で。
- Issue 本文に書かれた既存の設計サマリーを尊重し、AI が独断で書き換えない。
- ファイル名は kebab-case を厳守。
- `assets/` は空のまま作成する（後続 Phase で使う）。
