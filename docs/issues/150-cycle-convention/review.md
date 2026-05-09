# レビュー FB と自己改善 (PR #150)

Phase 5 (`/wrap-issue`) のドッグフード実証。本 PR で受けた claude-review の指摘を集約し、ナレッジ化判断を行う。

## レビューコメント

| # | 出所 | 内容 | 対応 | コミット |
| --- | --- | --- | --- | --- |
| 1 | claude-review (Bot) | `claude-code-review.yml` の `id-token: write` は OIDC 不使用で不要 | **却下（指摘誤り）**。実行ログに `Requesting OIDC token... / Exchanging OIDC token for app token... / Using GITHUB_TOKEN from OIDC` があり、claude-code-action は内部で OIDC → GitHub App token を取得しているため `id-token: write` は必須。コメントを workflow に追記して再発防止 | (本 PR 内で対応) |
| 2 | claude-review (Bot) | `wrap-issue/SKILL.md` Step 1 でリポ名 `sode0417/factrail` がハードコード。fork・リネーム耐性のため `gh repo view --json nameWithOwner` で動的取得すべき | 修正 | (本 PR 内で対応) |
| 3 | claude-review (Bot) | `start-issue/SKILL.md` Step 5 の `git checkout -b` は既存ブランチで失敗する。事前チェック or `git switch -c` への変更を推奨 | 修正（事前チェック追加） | (本 PR 内で対応) |
| 4 | claude-review (Bot) | バイナリ資産（assets PNG 90+）の git 肥大。将来的には GitHub Issue 添付の活用も検討 | ユーザー指示「使用しなかったロゴやモック画面は削除してほしい」「中間生成物は削除で良い」を受けて削除実施。ロゴ 13 + モック中間版/不採用 70 ファイルを削除 | (本 PR 内で対応) |
| 5 | claude-review (Bot, 2回目) | `claude_args: \|` → `\|-` で trailing newline 除去 | 別 PR（workflow 変更は main 完全一致制約のため） | — |
| 6 | claude-review (Bot, 2回目) | `id-token: write` にインラインコメント追加して再発防止 | 別 PR（workflow 変更は main 完全一致制約のため） | — |
| 7 | claude-review (Bot, 2回目) | `_template/README.md` の Issue URL ハードコード | 修正（プレースホルダ `<ISSUE_URL>` 化 + `start-issue` Step 3 で動的置換） | (本 PR 内で対応) |
| 8 | claude-review (Bot, 2回目) | `verify-issue` の Playwright MCP 利用可否判定が暗黙 | 修正（`mcp__playwright_*__browser_*` 利用可能性を最初に確認する旨を Step 3 に追記） | (本 PR 内で対応) |
| 9 | sode0417 (User) | アプリで使用しなかったロゴやモック画面を削除 | 対応（ロゴ 13 + モック中間版/不採用 70 ファイル削除、index.html を採用版のみに更新） | (本 PR 内で対応) |

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
- **CLAUDE.md 整備の必要性**: 本 PR 中にユーザーから「CLAUDE.md があった方が良い」と指摘を受けて新設。`.claude/instructions.md` は自動読み込みされない（`@` 参照が必要）ため、毎セッション必須のルールはルート `CLAUDE.md` に集約するのが Claude Code 公式のベストプラクティス。本 PR で 200 行以内の凝縮版を新設し、詳細は既存 `.claude/instructions.md` 等を `@` 参照する構成にした。
- **workflow ファイルの main 完全一致制約**: claude-code-action の検証ロジックにより、PR ブランチで workflow を変更すると validation 失敗。本 PR 中に 1 度発生 → main に cherry-pick で先反映する運用を確認。今後 workflow 修正は別 PR で main 直接マージするか、cherry-pick で先反映する。
