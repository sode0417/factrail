# テスト計画

`README.md` の受入条件と整合させる。`/verify-issue` がこのチェックリストを順に消化する。

## 自動テスト

本 Issue は workflow YAML の変更のみで、アプリ側の自動テスト追加は不要。
代わりに **CI 経由での挙動確認**を主体とする。

| 種別 | 対象 | 期待挙動 |
| --- | --- | --- |
| GitHub Actions workflow validation | claude-code-action | main と PR の workflow が一致した状態で pass |
| claude-review CI | PR ブランチ | OIDC → App token 交換が成功し、レビューコメントが投稿される |

> **注**: factrail の CI には YAML lint job はないため、YAML 構文確認は手動検証に含める。

## 手動検証

- [ ] **シナリオ 1: workflow validation 通過**: PR ブランチに workflow 変更を push → 一度 fail を確認 → main に cherry-pick → 空コミット push で再走 → claude-review が pass する
- [ ] **シナリオ 2: 誤指摘の再発防止確認**: claude-review の Bot コメント本文を読み、`id-token: write` および `claude_args: |` についての指摘が**含まれていない**ことを確認
- [ ] **シナリオ 3: claude_args の引数末尾改行除去**: 以下のいずれかで確認
  - **主**: ファイル直接確認 `grep -A1 'claude_args:' .github/workflows/claude-code-review.yml` で `|-` が使われていることを目視
  - **代替**: CI ログで `--allowedTools` の引数値が末尾改行を持たないことを確認（`gh run view <id> --log` で `claude_args` 関連の行）。ログに展開後の値が出ない場合は主の方法のみで OK
- [ ] **シナリオ 4: 他 workflow 不変**: `git diff main..HEAD .github/workflows/` の対象ファイルが `claude-code-review.yml` のみ
- [ ] **シナリオ 5: YAML 構文確認** (任意): `npx js-yaml .github/workflows/claude-code-review.yml` でパースエラーが出ないことを確認

## 非機能・回帰

- [ ] PR マージ前に main の `claude-code-review.yml` が一時的に PR と一致した状態になるが、ロジックは変わらないため挙動回帰なし
- [ ] 他のワークフロー（claude.yml, ci-api.yml, ci-web.yml, test-*.yml, security.yml）は変更されない
- [ ] PR コメント投稿が日本語で行われ、これまでのレビュースタイルと一貫している

## 検証エビデンス

スクショ・録画は `assets/` に置き、ファイル名で対応シナリオがわかるようにする。

| シナリオ | エビデンス |
| --- | --- |
| 1: workflow validation 通過 | `verify-01-ci-pass.png` (CI 全 PASS のスクショ) |
| 2: 誤指摘の再発防止 | `verify-02-bot-review.png` (Bot コメントの該当箇所) |
| 3: 引数末尾改行除去 | `verify-03-grep.txt` (`grep -A1 'claude_args:' ...` の結果) |
| 4: 他 workflow 不変 | `verify-04-diff.txt` (`git diff` 結果) |
| 5: YAML 構文 (任意) | `verify-05-yaml-lint.txt` (`npx js-yaml ...` の結果) |
