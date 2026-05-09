---
name: wrap-issue
description: |
  PR レビューと検証の FB を集約し、ナレッジ化判断を行う。skill/CLAUDE.md/規約に落とすべき学びを抽出して別 PR で反映する。
  factrail の開発サイクル Phase 5 を担当。
  「/wrap-issue」「FB 集約」「Issue を閉じる前に振り返る」などのリクエスト時に使用。
---

# wrap-issue スキル

`docs/issues/README.md` の Phase 5（FB 集約 + 自己改善）を実行する。Issue / PR 番号を受け取り、`docs/issues/<NNN>-<slug>/review.md` にレビュー履歴を集約し、ナレッジ化候補を抽出する。

## 入力

- Issue 番号 (`<NNN>`)。省略時は現在のブランチ名から推測。
- 関連 PR 番号は `gh pr list --head <branch>` で自動取得。複数ある場合は AskUserQuestion で選択。

## Step 1: PR レビューコメントの収集

```bash
# PR 本体のレビュー
gh pr view <PR> --json reviews,comments,body,title,state

# 行コメント
gh api repos/sode0417/factrail/pulls/<PR>/comments

# レビュー本文
gh api repos/sode0417/factrail/pulls/<PR>/reviews
```

- claude-code-review (Bot) のコメントも含める。
- ユーザー自身がレビューで書いた指摘も対象。

## Step 2: review.md への転記

`docs/issues/<NNN>-<slug>/review.md` の「レビューコメント」表に行を追加:

| # | 出所 | 内容 | 対応 | コミット |
| --- | --- | --- | --- | --- |
| 1 | claude-code-review | <要約> | <修正内容> | `<sha>` or "据え置き理由" |

- 対応済み: 修正コミット SHA を記載
- 対応せず: 理由を記載（"設計上の意図", "別 Issue で対応" など）

## Step 3: ナレッジ昇華の判断

review.md で集約した FB 一つひとつを以下の判断軸で分類（`docs/issues/README.md` Phase 5 と同じ軸）:

| 判断軸 | 反映先候補 |
| --- | --- |
| 3 回以上同じ FB が出ている | ルール化候補（下のいずれか） |
| どのプロジェクトでも当てはまる | グローバル `~/.claude/CLAUDE.md` または `~/.claude/skills/` |
| factrail 固有 | プロジェクト `CLAUDE.md` または `.claude/skills/` |
| 単発の判断・履歴 | `review.md` に蓄積のみ |

過去の `docs/issues/*/review.md` を grep して再発判定:

```bash
grep -r "<キーワード>" docs/issues/*/review.md
```

3 回以上ヒットしたら「ルール化候補」と明記する。

## Step 4: ナレッジ反映の提案

ルール化候補について、AskUserQuestion で「今 PR に含めて修正 / 別 PR / 据え置き」を選ばせる:

- **今 PR に含めて修正**: 軽微なドキュメント追記程度
- **別 PR**: skill 修正・CLAUDE.md 大幅追加など
- **据え置き**: まだ収束していない、議論が必要

別 PR 化する場合、ブランチ名は `chore/wrap-<NNN>-<目的>` を提案。

## Step 5: 振り返りメモ

`review.md` の「振り返り」セクションに、次サイクルへの示唆を 3 行以内で記録:

- 設計時に見落とした観点
- テスト計画の漏れ
- 想定外の依存

## Step 6: マージ前の最終チェック

- [ ] `test-plan.md` の全項目が ✅ または ⚠️（理由付き）
- [ ] `review.md` のレビューコメント全てに対応 or 据え置き理由あり
- [ ] PR 本文に `Fixes #<NNN>` がある
- [ ] CI / claude-code-review が通っている

すべて OK なら、ユーザーにマージを促す（マージは AI が勝手に押さない）。

## 注意点

- ナレッジ反映の独断 push は厳禁。「別 PR」を提案するに留める。
- レビューコメントを review.md に転記する際、原文を改変しない（要約は対応列に書く）。
- Bot のレビューも人間と同等に扱う（`claude-code-review` は重要な指摘源）。
