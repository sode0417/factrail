# テスト計画

`README.md` の受入条件と整合させる。`/verify-issue` がこのチェックリストを順に消化する。

本 Issue は **規約（ドキュメント / skill / workflow）の変更**であり、アプリ側の自動テストは追加しない。検証は **規約の整合性確認 + 実フロー再現**を主体とする。

> **注**: factrail の CI には YAML lint job はないため、YAML 構文確認は手動検証に含める。

## 自動テスト

| 種別 | 対象 | 期待挙動 |
| --- | --- | --- |
| GitHub Actions workflow validation | claude-code-review.yml + 他 5 workflow | main と PR の workflow が一致した状態で pass |
| claude-review (Phase 1 prompt) | 本 PR (Draft 状態) | Phase 1 専用 prompt で起動し、設計レビューが返る |
| claude-review (Ready 後) | 本 PR (Ready 状態) | 通常 prompt で起動し、実装レビューが返る |
| 他 CI (ci-api, ci-web, test-api, test-web, security) | 本 PR (Draft) | `if: !draft` により skip される |
| 他 CI (Ready 後) | 本 PR (Ready) | 通常通り走る |

## 手動検証

### A. 規約ドキュメントの整合性

- [ ] **A-1: README.md の Phase 表とフローが矛盾しない**: `docs/issues/README.md` の 6 Phase 説明 + PR 状態表 + マージ方式 + コミットメッセージ表が互いに矛盾しないことを通読確認
- [ ] **A-2: skill の Step 番号と README.md の参照が一致**: `start-issue/SKILL.md` の Step 番号と `README.md` Phase 1 説明から参照される Step 番号が一致
- [ ] **A-3: CLAUDE.md の開発サイクル節が README.md と同期**: 200 行以内を維持しつつ、Phase 4 自動 Ready 切替の言及があること

### B. workflow 変更の動作

- [ ] **B-1: claude-code-review.yml の Phase 1 prompt 分岐**: `[Phase 1] xxx` タイトルの本 PR で claude-review が走り、設計レビュー観点（要件展開・シーケンス・テスト計画・スコープ）に絞られた内容を返すこと
- [ ] **B-2: Ready 切替時の prompt 自動切替**: Phase 4 の **「タイトル更新 → `gh pr ready`」の順序**を守り、`ready_for_review` イベント発火時点でタイトルが既に `[Phase 1]` 除去済 → claude-review が **通常 prompt** で起動すること（順序が逆だと空コミット必要、それは避ける）
  - 検証: `gh run view <id> --log` で `ready_for_review` イベントの run と PR タイトルのタイムスタンプを比較
- [ ] **B-3: ドラフト中は他 CI が skip される**: Draft 状態で `gh pr checks` し、claude-review 以外の CI が走っていないこと（pending or skipped）
- [ ] **B-4: Ready 後に他 CI が走る**: Ready 切替後、ci-api, ci-web, test-api, test-web, security が走り pass すること
- [ ] **B-5: workflow YAML 構文**: `npx js-yaml .github/workflows/{claude-code-review,ci-api,ci-web,test-api,test-web,security}.yml` でパースエラーが出ないこと

### C. skill の動作

- [ ] **C-1: `/start-issue` がドラフト PR まで作る**: Phase 1 の最後で `gh pr create --draft` が実行され、`[Phase 1]` プレフィックスのタイトルになること（本 PR 自身が C-1 のエビデンス）
- [ ] **C-2: `/verify-issue` の Ready 切替条件分岐**: 以下の二段階で確認
  - **C-2a (必須)**: SKILL.md に「test-plan 未チェック count → 0 なら Ready 切替 + タイトル更新、それ以外は Draft 維持 + 保留理由記録」と `|| true` 含む実例コードが明記されていること
  - **C-2b (D-3 成功時のみ)**: ブラウザ完結 PoC が部分成功した場合、実際に `/verify-issue` を E2E で動かし Ready 切替が動作することを確認
  - D-3 が失敗 / 未検証の場合は C-2a のみで満たし、E2E 確認は別 Issue へ
- [ ] **C-3: slug 候補提示の Step 化**: `start-issue/SKILL.md` の Step 1 に「slug 候補を 2-3 提示」が記述されていること

### D. ブラウザ完結検証 (PoC)

- [ ] **D-1: Issue コメントから @claude /start-issue 起動**: 検証用ダミー Issue を作成し、`@claude /start-issue <issue番号>` をコメント投稿。claude.yml workflow が起動するか確認
- [ ] **D-2: claude-code-action 内で skill 読み込みが効くか**: D-1 で起動した job のログに `start-issue` skill の Step が実行されている形跡があるか確認
- [ ] **D-3: Bot がブランチ push / ドラフト PR 作成できるか**: D-1 が正常進行した場合、claude[bot] によるコミット・PR 作成が確認できるか
- [ ] **D-4: 失敗時の挙動記録**: D-1〜D-3 が失敗する場合、ログを review.md にコピーし、原因（権限・skill 認識・プロンプト解釈）を分類

> ⚠️ D については **PoC 失敗が想定される**。失敗した場合も `review.md` に「現時点では未対応、別 Issue で対応」と明記して受入条件を満たす。

## 非機能・回帰

- [ ] 既存の Issue #149 (UI レスポンシブ) や進行中 Issue に影響なし
- [ ] PR #150, #152 マージ済みコミットに影響なし
- [ ] PR コメント投稿が日本語で行われ、これまでのレビュースタイルと一貫している

## 検証エビデンス

| シナリオ | エビデンス |
| --- | --- |
| A-1〜A-3: 規約整合性 | `assets/verify-A-grep.txt` (関連箇所の grep) |
| B-1, B-2: prompt 分岐 | `assets/verify-B-bot-comment-{phase1,ready}.txt` |
| B-3, B-4: CI skip / 走行 | `assets/verify-B-ci-checks-{draft,ready}.txt` |
| B-5: YAML 構文 | `assets/verify-B-yaml-lint.txt` |
| C-1〜C-3: skill 動作 | `assets/verify-C-skill-grep.txt` |
| D-1〜D-4: ブラウザ完結 | `assets/verify-D-browser-poc.md` (詳細記録) |
