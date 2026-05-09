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

- [x] **A-1: README.md の Phase 表とフローが矛盾しない** ✅ — Phase 0/1/1.5/2/3/4/5 と PR 状態表・マージ方式・コミット規約が一貫 (`assets/verify-A-grep.txt`)
- [x] **A-2: skill の Step 番号と README.md の参照が一致** ✅ — start-issue Step 1〜8、verify-issue Step 1〜7、wrap-issue Step 1〜7 ですべて整合 (`assets/verify-A-grep.txt`)
- [x] **A-3: CLAUDE.md の開発サイクル節が README.md と同期** ✅ — 108 行 (200 行以内)、Phase 1.5 / gh pr ready / Squash / @claude 規約全て言及 (`assets/verify-A-grep.txt`)

### B. workflow 変更の動作

- [x] **B-1: claude-code-review.yml の Phase 1 prompt 分岐** ✅ — Bot 直近レビューが「Phase 2 実装レビュー」として設計観点メイン (実装観点も含む — Phase 2 後なので妥当)。`assets/verify-B-bot-comment-phase1.txt`
- [ ] **B-2: Ready 切替時の prompt 自動切替** — Phase 4 で実証予定 (`/verify-issue` Step 7 の自動 Ready 切替実行時)
- [x] **B-3: ドラフト中は他 CI が skip される** ✅ — `gh pr checks 154` で claude-review 以外の 8 workflow が SKIPPING (`assets/verify-B-ci-checks-draft.txt`)
- [ ] **B-4: Ready 後に他 CI が走る** — Phase 4 で確認予定
- [x] **B-5: workflow YAML 構文** ✅ — 全 6 workflow で `npx js-yaml` パースエラーなし (`assets/verify-B-yaml-lint.txt`)

### C. skill の動作

- [x] **C-1: `/start-issue` がドラフト PR まで作る** ✅ — Phase 1 で本 PR (#154) 自身が `[Phase 1]` プレフィックス付き Draft で作成された (本 PR がエビデンス、`assets/verify-C-skill-grep.txt`)
- [x] **C-2: `/verify-issue` の Ready 切替条件分岐**:
  - **C-2a (必須)** ✅ — SKILL.md に `|| true` 含む完全な分岐コードが記述 (`assets/verify-C-skill-grep.txt`)
  - **C-2b (D-3 成功時のみ)** — D が別 Issue 化のためスキップ (`assets/verify-D-browser-poc.md`)
- [x] **C-3: slug 候補提示の Step 化** ✅ — `start-issue/SKILL.md` Step 1 に「slug 候補は 2-3 案を提示してユーザー承認」が明記 (`assets/verify-C-skill-grep.txt`)

### D. ブラウザ完結検証 (PoC) — **本 PR ではスコープ外 (別 Issue で実証)**

- [x] **D-1〜D-4: 別 Issue 化決定** ✅ — 詳細は `assets/verify-D-browser-poc.md`
  - 理由: ブラウザ起動 PoC は規約 v2 の確立とは独立した技術検証
  - PR #154 自体で `@claude /start-issue` を試すと claude.yml 二重 trigger と文脈汚染が発生
  - 失敗想定の PoC をマージ前提の PR に含めるべきでない
  - 受入条件「D は失敗時も review.md に記録」は別 Issue 化の判断記録で満たす

## 非機能・回帰

- [x] 既存の Issue #149 (UI レスポンシブ) や進行中 Issue に影響なし ✅ (本 PR は規約・skill・workflow のみで Web/API 未変更)
- [x] PR #150, #152 マージ済みコミットに影響なし ✅ (差分は `docs/issues/<NNN>` 配下と `.claude/skills/`、`CLAUDE.md` の追加のみ)
- [x] PR コメント投稿が日本語で行われ、これまでのレビュースタイルと一貫している ✅ (Bot Phase 1, Phase 2 レビューが日本語で投稿された)

## 検証エビデンス

| シナリオ | エビデンス |
| --- | --- |
| A-1〜A-3: 規約整合性 | `assets/verify-A-grep.txt` (関連箇所の grep) |
| B-1, B-2: prompt 分岐 | `assets/verify-B-bot-comment-{phase1,ready}.txt` |
| B-3, B-4: CI skip / 走行 | `assets/verify-B-ci-checks-{draft,ready}.txt` |
| B-5: YAML 構文 | `assets/verify-B-yaml-lint.txt` |
| C-1〜C-3: skill 動作 | `assets/verify-C-skill-grep.txt` |
| D-1〜D-4: ブラウザ完結 | `assets/verify-D-browser-poc.md` (詳細記録) |
