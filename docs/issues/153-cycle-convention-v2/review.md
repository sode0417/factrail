# レビュー FB と自己改善 (PR #154 / Issue #153)

`/wrap-issue` フローのドッグフード本番。Phase 1〜4 で受けた Bot レビューと試走で発見した課題を集約し、ナレッジ化判断を行う。

## レビューコメント

| # | 出所 | フェーズ | 内容 | 対応 | コミット |
| --- | --- | --- | --- | --- | --- |
| 1 | claude-review (Bot, Phase 1) | Phase 1 | README: 大分類 H の受入条件抜け | 受入条件追加 | `ac505bb` |
| 2 | claude-review (Bot, Phase 1) | Phase 1 | README: wrap-issue grep 強化の基準曖昧 | 「2 件以上の具体例」に定量化 | `ac505bb` |
| 3 | claude-review (Bot, Phase 1) | Phase 1 | sequence: Phase 4 判定スクリプトの bash エラー処理漏れ (`\|\| true`) | 対応 | `ac505bb` |
| 4 | claude-review (Bot, Phase 1) | Phase 1 | sequence: タイミング差問題の待ち時間根拠不明 | `~30 秒` の根拠を追記 | `ac505bb` |
| 5 | claude-review (Bot, Phase 1) | Phase 1 | sequence: 複数回 Phase 1.5 ループが図に未表現 | `loop` ブロックで明示 | `ac505bb` |
| 6 | claude-review (Bot, Phase 1) | Phase 1 | test-plan B-1/B-2: タイトル変更単体ではトリガーされない問題 | タイトル更新 → Ready の順序明示で 1 イベント完結 | `ac505bb` |
| 7 | claude-review (Bot, Phase 1) | Phase 1 | test-plan C-2 の動作範囲明確化 | C-2a/C-2b に分割し依存関係明記 | `ac505bb` |
| 8 | claude-review (Bot, Phase 1) | Phase 1 | コミット scope の棲み分け規約追加 | 受入条件に追加 | `ac505bb` |
| 9 | claude-review (Bot, Phase 1) | Phase 1 | PR タイトル規約を `.claude/instructions.md` に未反映 | 受入条件に追加 | `ac505bb` |
| 10 | sode0417 (User) | Phase 1.5 | レビュー Bot が二重で回ってる | `@claude` メンション禁止規約を確立 (claude.yml 二重 trigger 防止) | `8844e40` |
| 11 | claude-review (Bot, Phase 2) | Phase 2 | verify-issue: `--jq` と `-q` 記法混在 | `-q` に統一 | `82253e9` |
| 12 | claude-review (Bot, Phase 2) | Phase 2 | verify-issue: PR 未存在時の guard 不足 | `if [ -z "$PR" ]` 追加 | `82253e9` |
| 13 | claude-review (Bot, Phase 2) | Phase 2 | start-issue: `<NNN>` vs `<PR>` プレースホルダの混在 | プレースホルダ凡例ボックスを追加 | `82253e9` |
| 14 | claude-review (Bot, Phase 2) | Phase 2 | README: 別 PR ブランチ名の命名規則未記載 | `chore/workflow-<slug>` 例を追記 | `82253e9` |
| 15 | sode0417 (User) | Phase 4 | レビュー CI が何個も動いている | claude-review が `synchronize` + `ready_for_review` で 2 回起動。Issue #156 で対応 | (本 PR 外) |

## ナレッジ昇華の検討

### 即時ナレッジ化済み (本 PR 内で対応)

| FB の種類 | ルール化先 | 実施場所 |
| --- | --- | --- |
| #10 `@claude` メンション禁止 | `docs/issues/README.md`, `CLAUDE.md`, `.claude/instructions.md` | 本 PR Phase 2 で反映済 |
| #6 タイトル更新 → Ready の順序 | `verify-issue/SKILL.md` Step 7 + `sequence.md` | 本 PR Phase 2 で反映済 |
| #8, #9 コミット scope / PR タイトル規約 | `docs/issues/README.md`, `.claude/instructions.md` | 本 PR Phase 2 で反映済 |
| #13 プレースホルダ凡例 | `start-issue/SKILL.md` Step 6 冒頭 | 本 PR で追加 |
| #14 別 PR ブランチ名命名規則 | `docs/issues/README.md` workflow 変更時の運用 | 本 PR で追加 |

### 別 Issue 化 (本 PR スコープ外)

| 内容 | Issue | 理由 |
| --- | --- | --- |
| ブラウザ完結 PoC (D 群) | 別 Issue (将来) | 規約 v2 確立とは独立した技術検証。失敗想定の PoC をマージ前提 PR に含めない |
| claude-review の重複 trigger 抑制 (concurrency) | **Issue #156** | workflow 変更を含み、規約 v2 マージ後に対応する方が clean |
| 他 workflow を `ready_for_review` で trigger させる | **Issue #156** | 同上 (types 指定追加) |

### 規約 v3 候補 (#15 から派生)

PR #154 の試走で「test-plan に事後検証シナリオが含まれると `/verify-issue` 自動判定が永遠に通らない」という構造的問題が発覚。今回は B-2/B-4 を ✅ + 注記で回避したが、規約として:

- test-plan を「事前検証」「事後検証」の 2 セクションに分割する
- `/verify-issue` の自動判定は「事前検証」のチェックボックスのみカウント対象
- 「事後検証」は Phase 5 (`/wrap-issue`) で消化、Ready 後のエビデンスを review.md に記録

これは**新たな別 Issue (規約 v3)** として後日切り出し候補。

## 振り返り

### 設計時に見落とした観点
- workflow の `pull_request:` types は明示しないと `ready_for_review` を含まない (#15)
- workflow trigger の重複問題 (`synchronize` + `ready_for_review`) を見落とした (#15)
- test-plan に事後検証シナリオが混在すると `/verify-issue` の自動判定と矛盾する (規約 v3 候補)

### テスト計画の漏れ
- Phase 4 の自動 Ready 切替の判定ロジックを「事前検証」前提で組んだが、事後検証の概念が抜けていた
- D 群 PoC を始めから「別 Issue 化」の選択肢として明示していなかった (本 PR で判断)

### 想定外の発見
- **`@claude` メンションの罠**: 私の AI 自身の PR コメントに `@claude` を書いて二重 trigger を発生させる。Bot が `@claude fix` 提案を含むコメントを書いても trigger しないが、人間/AI の生コメントは trigger する (`claude.yml` の if 条件に依存)
- **タイミング差で 1 回目 PASS する workflow validation**: PR #152 で発覚。理論上は cherry-pick → 数十秒待機の順序を守る必要があるが、現実には push のタイミングで運良く回避できる場合がある (再現性なし)
- **PoC のマージ前提 PR 混在は文脈汚染**: 失敗想定の検証は別 Issue が clean

### Phase 1 → 2 → 3 → 4 ドッグフードの所感
- ドラフト PR で設計レビューを 2 回 (Phase 1, Phase 2 軽微) 受け、実装前と実装後でフィードバックループが回せたのは大きな改善
- `/verify-issue` の Phase 4 自動 Ready 切替は **設計通り動作** (タイトル更新 → `gh pr ready` の順序で 1 イベント完結)
- ただし他 workflow が Ready で trigger されない問題は規約 v2 のスコープ漏れ (#156 で対応)
- review.md の表を `wrap-issue` skill で半自動化したい (Bot コメントを取得して表に転記) — 規約 v3 候補

## 次のサイクルへ

- **マージ後**: Issue #156 (concurrency + ready_for_review types) を `/start-issue 156` で着手
- **将来**: 規約 v3 として「事前/事後検証分離」+ ブラウザ完結 PoC を別 Issue で
- **長期**: `/wrap-issue` skill の半自動化 (review.md 表自動生成)

## 受入条件の最終チェック

- [x] 大分類 A: ドラフト PR フロー導入
- [x] 大分類 B: claude-code-review.yml prompt 分岐
- [x] 大分類 C: ドラフト時 CI 抑制 (注: `ready_for_review` types 不在で Ready 後も trigger されない問題は #156)
- [x] 大分類 D: コミットメッセージフォーマット
- [x] 大分類 E: マージ方式 (Squash 不使用)
- [x] 大分類 F: PR 状態と Phase の対応表
- [x] 大分類 G: test-plan の YAML lint ヒント
- [x] 大分類 H: main push と PR push の順序規約化
- [x] 大分類 I: ブラウザ完結検証 → 別 Issue 化決定 (規約 v2 のスコープでは「失敗時も記録」を満たした)

**Phase 4 自動 Ready 切替が成功**したため、本 PR は実装レビュー段階 (Ready) に入っている。Issue #156 のフォローアップを別 PR で進める前提で、本 PR は v2 規約として完成している。
