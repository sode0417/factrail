# レビュー FB と自己改善 (PR #152)

`/wrap-issue` フローのドッグフード本番。Phase 1 (設計) と Phase 2 (実装) で受けた Bot レビューを集約し、ナレッジ化判断を行う。

## レビューコメント

| # | 出所 | フェーズ | 内容 | 対応 | 検証 |
| --- | --- | --- | --- | --- | --- |
| 1 | claude-review (Bot) | Phase 1 | sequence.md: main push 拒否時のフォールバックがシーケンス本流にない | `alt`/`else` 分岐で別 PR 戦略を追加 | コミット `ad74333` |
| 2 | claude-review (Bot) | Phase 1 | sequence.md: cherry-pick + squash で履歴に二重コミット問題 | 「マージ方式の注意」節を追加、merge / rebase 推奨 | コミット `ad74333` |
| 3 | claude-review (Bot) | Phase 1 | test-plan.md: シナリオ 3 検証が CI ログ依存で弱い | `grep` ファイル直接確認を主、CI ログを代替に | コミット `ad74333` |
| 4 | claude-review (Bot) | Phase 1 | test-plan.md: YAML lint が自動か手動か曖昧 | 自動表から除去、手動シナリオ 5 (任意) として追加 | コミット `ad74333` |
| 5 | claude-review (Bot) | Phase 2 | README.md ステータス「設計中」のまま | 「検証完了（PR レビュー・マージ待ち）」に更新 | コミット (Phase 3 集約コミット) |
| 6 | claude-review (Bot) | Phase 2 | `prompt: \|` と `claude_args: \|-` の記法混在の補足コメント追加（任意） | 据え置き（意図通りの使い分けで可読性十分。次回 workflow 改修時に検討） | — |

## ナレッジ昇華の検討

> 判断軸（`docs/issues/README.md` Phase 5 参照）
> - 3 回以上同じ FB → ルール化候補
> - どのプロジェクトでも当てはまる → グローバル
> - factrail 固有 → プロジェクト
> - 単発の判断 → 本ファイルに蓄積のみ

| FB の種類 | ルール化先候補 | 実施先 |
| --- | --- | --- |
| #1 main push 拒否時のフォールバック分岐 | workflow 変更を伴う Issue では sequence.md に `alt`/`else` 分岐を入れる規約化。Issue #153 の v2 規約候補 | Issue #153 で取り込み検討 |
| #2 cherry-pick + squash 履歴問題 | factrail 固有運用ルール。`docs/issues/README.md` の Phase 4 節に「workflow 変更を含む PR は merge / rebase マージ」を追記 | Issue #153 で取り込み |
| #3 検証コマンドは CI ログ依存より直接ファイル確認を主に | 一般則。次回再発したら `_template/test-plan.md` のヒントに記載 | 蓄積のみ（再発判定後） |
| #4 YAML lint job の有無を確認してから自動/手動を区分 | 一般則。`/start-issue` skill の Step 4「テスト計画」で「`.github/workflows/` の現状を確認した上で自動/手動を分類する」のヒント追記 | Issue #153 で取り込み候補 |

## 振り返り

### 設計時に見落とした観点
- Phase 1 で「workflow 変更時の main 完全一致制約」のフォールバックを sequence 本流に入れるべきだった（補足セクション任せにした）
- cherry-pick + squash の履歴問題は経験不足。merge 戦略の使い分けを Issue 開始時に決めるべきだった

### テスト計画の漏れ
- 検証コマンドが「動くかどうか」を事前に確認していなかった（CI ログに引数展開後の値が出るかは未確認だった）
- 自動テスト / 手動テストの区別を「実際に CI 設定を確認してから」決めるという当然のステップが抜けていた

### 想定外の発見
- **シナリオ 1 のタイミング差**: main push と PR push の順序とタイミング次第で workflow validation が新 main を先に見て 1 回目で PASS するケースがあった。シーケンス想定の「fail 1 回 → 再走」は再現性に欠ける
  - **改善案**: `git push origin main` を完全に終わらせてから（CI が反映されるまで数秒〜数十秒待ってから）PR push、という順序にすると安定。Issue #153 の v2 規約候補
- **ドラフト PR で全 CI が走る無駄**: ユーザー指摘 (Issue #153) の通り、ドラフト中は claude-review のみで十分。実装時には `if: github.event.pull_request.draft == false` を他 CI に追加する規約化が必要

### Phase 1 → Phase 2 ドッグフードの所感
- ドラフト PR で設計レビューを受け、実装前に sequence/test-plan を直せたのは大きな改善（実装やり直しゼロ）
- Bot 1 回目 (PR 全体レビュー prompt) で設計に踏み込んだ良いレビューが返った。Issue #153 の「Phase 1 専用 prompt 分岐」は重要だが、現状でも十分機能する
- review.md の表を更新する手間がやや大きい。`/wrap-issue` skill で半自動化したい（Bot コメントを取得して表に転記）— 別 Issue 候補

## 次のサイクルへ

本 PR マージ後、Issue #153 の Phase 1 (`/start-issue 153`) で本ファイルの「ルール化先候補」を v2 規約に取り込む。
