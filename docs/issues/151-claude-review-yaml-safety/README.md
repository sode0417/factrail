# #151 ci: claude-code-review.yml の YAML 安全化

> GitHub Issue: https://github.com/sode0417/factrail/issues/151
> ブランチ: `chore/151-claude-review-yaml-safety`
> ステータス: 設計中

## 要件 (Issue から展開)

PR #150 の Bot レビューで指摘された `.github/workflows/claude-code-review.yml` の軽微な改善 2 件。workflow 変更は claude-code-action の検証制約（main ブランチと完全一致が必須）があるため、PR #150 本体には含められず別 Issue として切り出した。

### 課題 1: `claude_args: |` の末尾改行
- `|` ブロックスカラーは引数末尾に `\n` を付与する
- 現状動作しているが引数パーサーによっては誤動作の可能性

### 課題 2: `id-token: write` のコメント不在
- claude-code-action は内部で OIDC → GitHub App token 交換に使用するため `id-token: write` は必須
- コメントが無いため AI レビュー (claude-code-review Bot) が「OIDC 未使用なら不要」と繰り返し誤指摘
- 実際 PR #150 で 1 回踏んだ（一度削除しかけた）

## 受入条件

- [ ] `claude_args: |` → `|-` に変更されている（trailing newline 除去）
- [ ] `id-token: write` の行末にインラインコメント `# Required: claude-code-action が内部で OIDC → GitHub App token 交換に使用` が追加されている
- [ ] PR の `claude-review` CI が pass し、Bot レビューで上記 2 点の指摘が**再発しない**こと
- [ ] 他のワークフロー（`claude.yml`, `ci-*.yml`, `security.yml`）は変更しない

## スコープ外

- 他の workflow の改善（別 Issue で対応）
- claude-code-action のバージョンアップ（v1 のまま）
- `permissions` ブロックの他項目見直し（最小権限原則の全面見直しは別 Issue）

## 設計サマリー

- 本 Issue の PR は **`.github/workflows/claude-code-review.yml` 1 ファイルのみの最小変更**とする
- claude-code-action の workflow validation 制約のため、以下フローで対応:
  1. PR ブランチで workflow 変更
  2. main にも cherry-pick で先反映（main と PR の workflow が一致してから CI を再走させる）
  3. PR で CI 結果を確認 → マージ
- 挙動は変えない、純粋なドキュメント性 + YAML 安全化

## 影響範囲

| エリア | ファイル / モジュール | 変更概要 |
| --- | --- | --- |
| API | — | 変更なし |
| Web | — | 変更なし |
| DB | — | 変更なし |
| CI / Infra | `.github/workflows/claude-code-review.yml` | YAML 記法の安全化、コメント追加 |

## 関連リンク

- 設計シーケンス: [sequence.md](./sequence.md)
- テスト計画: [test-plan.md](./test-plan.md)
- レビュー記録: [review.md](./review.md)
- アセット: [assets/](./assets/)
- 元の指摘: https://github.com/sode0417/factrail/pull/150#issuecomment-4411751310
- 誤検知判定の経緯: `docs/issues/150-cycle-convention/review.md` 指摘 #1
