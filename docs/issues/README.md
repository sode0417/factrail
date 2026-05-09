# Issue ベース開発サイクル

factrail の機能開発・改善は GitHub Issue を起点に、6 Phase のサイクルで進める。
本ディレクトリは **AI (Claude Code) 向けの詳細設計** を Issue 単位に蓄積する場所。

## 役割分担

| | GitHub Issue | `docs/issues/<NNN>-<slug>/` |
| --- | --- | --- |
| 読み手 | 人間 | AI (Claude Code) |
| 内容 | 要件 + 設計サマリー | 詳細設計（要件展開・シーケンス・テスト・FB） |
| 更新者 | 人間が起点、AI がサマリーを返書き | AI が主、ユーザー承認で確定 |

## ディレクトリ規約

```
docs/issues/
├── README.md            # 本ファイル
├── _template/           # 新規 Issue 用ひな形（/start-issue がコピー元として参照）
│   ├── README.md        #   要件展開・受入条件
│   ├── sequence.md      #   シーケンス図 (Mermaid)
│   ├── test-plan.md     #   テスト項目チェックリスト
│   └── review.md        #   PR レビュー FB・対応ログ
└── <NNN>-<slug>/        # Issue ごとの詳細設計（slug は kebab-case）
    ├── README.md
    ├── sequence.md
    ├── test-plan.md
    ├── review.md
    └── assets/          # スクショ・モックアップ・録画
```

- `<NNN>` は GitHub Issue 番号
- `<slug>` は Issue タイトルから生成した kebab-case（`/start-issue` が提案）
- ブランチ名は `feat/<NNN>-<slug>` / `fix/<NNN>-<slug>` / `chore/<NNN>-<slug>` 等

## 開発サイクル

### Phase 0: 要件提起 [人間]

- GitHub Issue を作成し、要件と設計サマリーを書く
- ラベル: `project:factrail`, `type:{feature|bug|docs|chore|...}`, `priority:{critical|high|medium|low}`

### Phase 1: 詳細設計 [AI 主導 + 人間承認]

- skill: `/start-issue <NNN>`
- AI が `gh issue view <NNN>` で本文取得 → `docs/issues/<NNN>-<slug>/` を立ち上げ
- `_template/` をコピーし、`README.md` に Issue 本文を要件として展開
- `sequence.md`, `test-plan.md` をユーザーと対話で叩き台作成
- 完了時、設計サマリーを Issue に逆書き戻し（GitHub に履歴を残す）→ ユーザー承認

### Phase 2: 実装 [AI]

- ブランチ `feat/<NNN>-<slug>` を切って実装
- 設計乖離が出たら `docs/issues/<NNN>-<slug>/` を即時更新（実装と設計の同期）

### Phase 3: 検証 [AI 主導 + 人間承認]

- skill: `/verify-issue <NNN>`（任意）
- `test-plan.md` のチェックリストを順に消化
- スクショ・録画は `docs/issues/<NNN>-<slug>/assets/` 配下へ
- NG が出たら Phase 2 に戻る

### Phase 4: PR [AI]

- `gh pr create` で PR 作成。本文に `Fixes #<NNN>` を含める
- `claude-code-review` ワークフローが自動レビュー

### Phase 5: FB 集約 + 自己改善 [AI]

- skill: `/wrap-issue <NNN>`
- PR レビューコメントを `review.md` に集約
- 「skill / CLAUDE.md / 規約に落とすべき学び」を抽出
  - 判断軸:
    - **3 回以上同じ FB が出ている** → ルール化候補
    - **どのプロジェクトでも当てはまる** → グローバル `~/.claude/CLAUDE.md` または `~/.claude/skills/`
    - **factrail 固有** → プロジェクトの `CLAUDE.md` または `.claude/skills/`
    - **単発の判断・履歴** → `review.md` に蓄積のみ
- 必要があれば別 PR で skill / ドキュメントを更新

## skill 一覧（本サイクル専用）

| skill | Phase | 責務 |
| --- | --- | --- |
| `/start-issue <NNN>` | 1 | 詳細設計の起点を作る |
| `/verify-issue <NNN>` | 3 | test-plan の進捗管理（任意） |
| `/wrap-issue <NNN>` | 5 | レビュー FB を集約・ナレッジ昇華 |

## 補足

- 軽微な修正（typo・依存更新など）は本サイクルを省略してもよい。判断は AI が提案 → ユーザー承認。
- 過去の Issue を後追いで `docs/issues/<NNN>-<slug>/` に起こす場合、`assets/` のみで `README.md` は簡略化してよい（例: `143-ui-redesign/`）。
