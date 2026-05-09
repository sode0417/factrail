# D 群: ブラウザ完結 PoC — 本 PR では未検証 (別 Issue 化)

## 判断

D-1〜D-4（`@claude /start-issue` のブラウザ起動 PoC）は本 PR ではスコープ外として **別 Issue で本格実証**することにした。

## 理由

1. **失敗想定の PoC をマージ前提の PR で扱うべきでない**: test-plan.md で「失敗が想定される」と明記している通り、本 Issue (#153) のスコープは規約 v2 の確立であり、ブラウザ起動の動作実証ではない
2. **PoC のための新規 Issue / テストコメントは本 PR の文脈を汚す**: PR #154 自身に `@claude /start-issue` を試走すると claude.yml が起動して文脈混乱、レビュー本文も干渉する
3. **claude-code-action 内での skill 読み込み可否は別軸の検証**: `.claude/skills/<name>/SKILL.md` が claude-code-action の実行環境で context にロードされるかは、独立した技術検証として別 Issue で扱う方が責務が明快

## 別 Issue で扱うべき検証点

別 Issue (例: `#155 ブラウザ完結検証 PoC`) を立て、以下を実証する:

- D-1: 検証用ダミー Issue を作成し `@claude /start-issue <NNN>` をコメント投稿
- D-2: claude.yml workflow が起動した job のログに `start-issue` skill の Step 実行形跡があるか
- D-3: claude[bot] によるコミット・PR 作成が GitHub App token で可能か
- D-4: 失敗時の挙動を完全ログとして記録

## 本 PR でのカバー

- C-2a: `verify-issue/SKILL.md` に Ready 切替の実装が **明記** されている (`grep` で確認済み、`assets/verify-C-skill-grep.txt`)
- C-2b: D 失敗時はスキップする旨を test-plan.md に明記 → 本 PR ではスキップ
