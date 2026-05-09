# #153 規約 v2: ドラフト PR フロー + ブラウザ完結 + 周辺改善

> GitHub Issue: https://github.com/sode0417/factrail/issues/153
> ブランチ: `chore/153-cycle-convention-v2`
> ステータス: 設計中

## 要件 (Issue から展開)

PR #150 で導入した開発サイクル v1 を、PR #150・#152 の試運用で得た知見をもとに v2 へアップデートする。本 Issue は **1 PR で全変更を一括反映**する方針（1 Issue = 1 PR の原則）。

### 大分類

| 大分類 | 内容 | ファイル |
| --- | --- | --- |
| **A. ドラフト PR フロー導入** | Phase 1 完了時にドラフト PR を作成、Phase 4 で Ready に自動切替 | `docs/issues/README.md`, `start-issue/SKILL.md`, `verify-issue/SKILL.md` |
| **B. claude-code-review.yml の Phase 1 専用 prompt 分岐** | `[Phase 1]` PR タイトルを検出して設計レビュー専用 prompt に切替 | `.github/workflows/claude-code-review.yml` |
| **C. ドラフト PR では他 CI を抑制** | `if: github.event.pull_request.draft == false` を他 5 workflow に追加（claude-review 除く） | `ci-api.yml`, `ci-web.yml`, `test-api.yml`, `test-web.yml`, `security.yml` |
| **D. Bot レビュー応答コミットメッセージの統一フォーマット** | `docs(<NNN>): Phase N <内容>` の規約化 | `docs/issues/README.md` |
| **E. マージ方式の規約化** | Merge commit を標準（Phase 別 commit を main 履歴に残す）、Squash 不使用 | `docs/issues/README.md` |
| **F. PR 状態と Phase の対応表** | Phase 1=Draft / 2-3=Draft / 4=Ready 切替 / 5=Ready の表 | `docs/issues/README.md` |
| **G. test-plan に「YAML lint job の有無を確認してから自動/手動を分類」のヒント追記** | `_template/test-plan.md` | テンプレ |
| **H. main push と PR push の順序を規約化** | タイミング差問題 (PR #152 で発覚) | `sequence.md` の例で示す |
| **I. ブラウザ完結検証** | `@claude /start-issue 151` で claude-code-action 経由起動が動作するか実証 | 検証ログ・スクショ |

### v1 → v2 の差分概要

```
[v1] Phase 1 → docs/issues/<NNN>-<slug>/ 作成 → Phase 2 で PR 作成 → ... マージ
[v2] Phase 1 → docs/issues/<NNN>-<slug>/ + ドラフト PR 作成 → Phase 2 → Phase 3 → Phase 4 で Ready 切替 → ... マージ
```

## 受入条件

### 規約・skill ドキュメント
- [ ] `docs/issues/README.md` v2 化（Phase 1 でドラフト PR 作成、Phase 4 で Ready 切替を明記）
- [ ] `docs/issues/README.md` に PR 状態 (Draft/Ready) と Phase の対応表
- [ ] `docs/issues/README.md` にマージ方式規約（Merge commit 標準、Squash 不使用）
- [ ] `docs/issues/README.md` に Bot 応答コミットメッセージの統一フォーマット表
- [ ] `.claude/skills/start-issue/SKILL.md` に「Step: ドラフト PR 作成」追加
- [ ] `.claude/skills/start-issue/SKILL.md` の Step 1 に「slug 候補を 2-3 提示する判断基準」追記
- [ ] `.claude/skills/verify-issue/SKILL.md` に「全 PASS なら Ready 切替 + タイトル更新」追加
- [ ] `.claude/skills/verify-issue/SKILL.md` に「test-plan 不完全時はドラフト維持 + 保留理由記録」追加
- [ ] `.claude/skills/wrap-issue/SKILL.md` の「ナレッジ昇華判断」に再発判定の具体的な grep コマンド例を **2 件以上** 追加（例: 「指摘内容のキーワード抽出」「過去 review.md 横断検索」など）
- [ ] `docs/issues/README.md` または `sequence.md` に **「workflow 変更時の main push → 30 秒待機 → PR push の順序」** を明文化（大分類 H）
- [ ] `docs/issues/README.md` または `CLAUDE.md` に **コミットメッセージ scope の使い分け規約**（Issue 関連は `<NNN>` 番号 scope、ドメイン横断は `feat(facts)` 等のドメイン scope）を追記
- [ ] `.claude/instructions.md` の「PR作成時の要件」に **PR タイトルフォーマット規約**（Phase 1 期間中は `[Phase 1] <Issue title>`、Ready 切替時に除去）を追加
- [ ] `_template/test-plan.md` に YAML lint job 有無確認のヒント追記
- [ ] `CLAUDE.md` の開発サイクル節を v2 に同期

### workflow 変更
- [ ] `claude-code-review.yml` が `[Phase 1]` PR タイトル検出で設計レビュー専用 prompt
- [ ] `ci-api.yml`, `ci-web.yml`, `test-api.yml`, `test-web.yml`, `security.yml` に `if: github.event.pull_request.draft == false` 追加（claude-review は除外）

### 検証
- [ ] PR #152 と同じフローを v2 規約で再現するドライラン (`docs/issues/<NNN>` の作成 → Phase 1 ドラフト PR → Phase 4 Ready 切替自動化) が成立
- [ ] ブラウザ完結検証: `@claude /start-issue` 試走の結果（成功・失敗・部分成功）が `review.md` に記録される

## スコープ外

- Phase 3-5 のブラウザ完結（`/verify-issue`, `/wrap-issue` の自動起動）— 別 Issue で
- claude-code-action のバージョンアップ
- 他 skill (`update-calendar-*`, `factrail-query` 等) のブラウザ対応
- Phase 2 (実装) 自体の自動起動（`@claude implement` 検証）— 別 Issue で

## 設計サマリー

**v2 規約の核**: 「ドラフト PR で設計レビュー → Ready で実装レビュー」の二段階レビュー。各段階の責務を明確化し、Phase 4 (Ready 切替) を `/verify-issue` の最終ステップとして自動化する。

**workflow 変更の反映戦略**: PR #152 と同様に main cherry-pick 戦略を取る。本 PR では `claude-code-review.yml` の prompt 分岐 + 他 5 workflow への `if: !draft` 追加が含まれるため、main 完全一致を維持しながら段階的に push する手順を sequence.md に明記。

**ブラウザ完結検証**: 本 PR の `@claude /start-issue` 検証はあくまで PoC。成功した範囲を documents、失敗した範囲を別 Issue（`@claude implement`、`@claude verify` 等の段階的対応）として切り出す。

## 影響範囲

| エリア | ファイル / モジュール | 変更概要 |
| --- | --- | --- |
| API | — | 変更なし |
| Web | — | 変更なし |
| DB | — | 変更なし |
| CI / Infra | `.github/workflows/claude-code-review.yml` | prompt 分岐追加 |
| CI / Infra | `.github/workflows/{ci-api,ci-web,test-api,test-web,security}.yml` | `if: !draft` 追加 |
| Docs | `docs/issues/README.md` | v2 規約全面書き直し |
| Docs | `docs/issues/_template/test-plan.md` | YAML lint ヒント追記 |
| Docs | `CLAUDE.md` | 開発サイクル節更新 |
| Skills | `.claude/skills/start-issue/SKILL.md` | ドラフト PR 作成 Step 追加 |
| Skills | `.claude/skills/verify-issue/SKILL.md` | Ready 切替 Step 追加 |
| Skills | `.claude/skills/wrap-issue/SKILL.md` | 再発判定強化 |

## 関連リンク

- 設計シーケンス: [sequence.md](./sequence.md)
- テスト計画: [test-plan.md](./test-plan.md)
- レビュー記録: [review.md](./review.md)
- アセット: [assets/](./assets/)
- v1 規約導入 PR: https://github.com/sode0417/factrail/pull/150
- v2 検討の発端 (PR #152 の試運用): https://github.com/sode0417/factrail/pull/152
- v1 振り返り: `docs/issues/150-cycle-convention/review.md`
- v1.5 試運用振り返り: `docs/issues/151-claude-review-yaml-safety/review.md`
