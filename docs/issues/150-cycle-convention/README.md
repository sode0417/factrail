# PR #150 開発サイクル規約 (docs/issues/) と skill 群を導入

> GitHub PR: https://github.com/sode0417/factrail/pull/150
> ブランチ: `chore/docs-issues-convention`
> ステータス: マージ準備中

## 概要（後追い記録）

本 PR は規約導入そのものなので、対応する GitHub Issue は無い（Issue 起点ではなく、ローカル整理から派生したフロー設計タスク）。
Phase 5 (`/wrap-issue`) のドッグフードとして `review.md` のみ実運用してみる。

## 設計サマリー

- GitHub Issue を起点に 6 Phase で進める「開発サイクル」を `docs/issues/README.md` に明文化
- AI 向け詳細設計の置き場を `docs/issues/<NNN>-<slug>/` に固定、テンプレを `_template/` に
- Phase 1/3/5 を担う 3 skill (`start-issue`, `verify-issue`, `wrap-issue`) を `.claude/skills/` に新設
- 既存 `docs/ui-review/` を `docs/issues/143-ui-redesign/assets/` に後追い移設

## 関連リンク

- レビュー記録: [review.md](./review.md)
