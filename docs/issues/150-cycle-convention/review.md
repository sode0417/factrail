# レビュー FB と自己改善 (PR #150)

Phase 5 (`/wrap-issue`) のドッグフード実証。本 PR で受けた claude-review の指摘を集約し、ナレッジ化判断を行う。

## レビューコメント

| # | 出所 | 内容 | 対応 | コミット |
| --- | --- | --- | --- | --- |
| 1 | claude-review (Bot) | `claude-code-review.yml` の `id-token: write` は OIDC 不使用で不要 | **却下（指摘誤り）**。実行ログに `Requesting OIDC token... / Exchanging OIDC token for app token... / Using GITHUB_TOKEN from OIDC` があり、claude-code-action は内部で OIDC → GitHub App token を取得しているため `id-token: write` は必須。コメントを workflow に追記して再発防止 | (本 PR 内で対応) |
| 2 | claude-review (Bot) | `wrap-issue/SKILL.md` Step 1 でリポ名 `sode0417/factrail` がハードコード。fork・リネーム耐性のため `gh repo view --json nameWithOwner` で動的取得すべき | 修正 | (本 PR 内で対応) |
| 3 | claude-review (Bot) | `start-issue/SKILL.md` Step 5 の `git checkout -b` は既存ブランチで失敗する。事前チェック or `git switch -c` への変更を推奨 | 修正（事前チェック追加） | (本 PR 内で対応) |
| 4 | claude-review (Bot) | バイナリ資産（assets PNG 90+）の git 肥大。将来的には GitHub Issue 添付の活用も検討 | 据え置き（情報項目）。本 PR は過去分後追い移設のため意図的 | — |

## ナレッジ昇華の検討

| FB の種類 | ルール化先候補 | 実施 PR |
| --- | --- | --- |
| #2 リポ名は `gh repo view --json nameWithOwner` で動的取得する | factrail プロジェクト固有ではなく一般則。グローバル `~/.claude/CLAUDE.md` の「GitHub Issue ワークフロー」節に追記候補。本 PR では skill 内修正に留め、再発したらグローバル化 | (現時点ではローカル修正のみ) |
| #3 ブランチ操作は既存チェック付き or `git switch -c` を使う | 同上、一般則。再発判定後にナレッジ化 | (現時点では skill 内修正のみ) |
| #4 大きなバイナリ資産の置き場 | factrail 固有運用。`docs/issues/README.md` に「assets サイズの判断基準（〇〇MB 超は GitHub Issue 添付を検討）」を追記する候補 | (将来 PR、3 回以上発生したら対応) |
| AI レビュー指摘の検証 | `wrap-issue/SKILL.md` Step 2-3 の間に「指摘内容を実装ログ・公式ドキュメントと突き合わせて誤検知判定」を入れる。誤検知だった場合は「却下」として review.md に理由付きで記録 | 本 PR 内で skill に反映するか、別 Issue で本格対応するか（再発判定後） |

判断軸:
- いずれの指摘も初回かつ単発のため、現時点では `docs/issues/<NNN>/review.md` の蓄積のみに留める
- 同様の指摘が `grep -r "<キーワード>" docs/issues/*/review.md` で 3 件以上ヒットしたら、ルール化候補として再評価

## 振り返り

- Phase 5 のドッグフード成功: 規約 PR の中で自分自身を `wrap-issue` フローに通せた
- 設計時に見落とした観点: skill 内のコマンド例は「動くサンプル」であり、ハードコードや既存ケース未対応に対する自然なレビュー指摘を受けた
- テスト計画の漏れ: マージ前のスモークテスト（既存 closed Issue で `/start-issue` を試走）を `_template/test-plan.md` の「自動テスト不可な skill のドライラン手段」として今後追記したい（次回別 Issue で対応候補）
- **重要な学び**: 指摘 #1 を実装ログ確認なしで対応しかけ、`id-token: write` を一度削除してしまった。AI レビューの指摘は誤検知もあるため、修正前にログ・実行結果と突き合わせて検証する手順を必ず踏むこと。ナレッジ化候補（次節）。
