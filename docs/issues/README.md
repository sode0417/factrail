# Issue ベース開発サイクル v2

factrail の機能開発・改善は GitHub Issue を起点に、6 Phase のサイクルで進める。
本ディレクトリは **AI (Claude Code) 向けの詳細設計** を Issue 単位に蓄積する場所。

> v2 規約のポイント: **「ドラフト PR で設計レビュー → Ready で実装レビュー」の二段階レビュー**。
> Phase 1 完了時にドラフト PR を作成し、Phase 4 (Ready 切替) を `/verify-issue` の最終ステップとして自動化。

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
- `<slug>` は Issue タイトルから生成した kebab-case（`/start-issue` が 2-3 候補を提示しユーザー承認）
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
- ブランチ `<type>/<NNN>-<slug>` を切って push
- **★ ドラフト PR を作成**（`gh pr create --draft`、タイトル `[Phase 1] <Issue title>`）
- 設計サマリーを Issue に逆書き戻し（GitHub に履歴を残す）→ ユーザー承認

### Phase 1.5: 設計レビュー対応 [AI が反映、人間が承認]

- ドラフト PR 上で `claude-review` (Bot) と人間がレビュー
- AI は `docs(<NNN>): Phase 1 設計レビュー FB を反映` でコミット応答
- 設計差し戻しは複数回ループ可
- 承認の合図: PR コメント or PR タイトルに `[approved]` 付与など、明示的な意思表示

### Phase 2: 実装 [AI]

- 同じ PR に実装コミットを積む（PR は **Draft のまま**）
- コミット: `feat(<NNN>): Phase 2 実装 - <概要>` または `fix(<NNN>): ...`
- 設計乖離が出たら `docs/issues/<NNN>-<slug>/` を即時更新（実装と設計の同期）

### Phase 3: 検証 [AI 主導 + 人間承認]

- skill: `/verify-issue <NNN>`
- `test-plan.md` のチェックリストを順に消化
- 検証エビデンスは `docs/issues/<NNN>-<slug>/assets/` 配下（テキスト or スクショ）
- コミット: `chore(<NNN>): Phase 3 検証エビデンス追加`
- NG が出たら Phase 2 に戻る

### Phase 4: PR Open (Ready 切替) [AI 自動]

- `/verify-issue` が test-plan の未チェック項目を count（`grep -c '^- \[ \]' ... || true`）
- **全 PASS の場合のみ自動で:**
  1. `gh pr edit <PR> --title "<title without [Phase 1]>"` でタイトル更新
  2. `gh pr ready <PR>` で Draft → Ready 切替
- **未チェック残あり / 一部 fail の場合:**
  - Draft を維持
  - 保留理由を `review.md` または PR コメントに記録 → 人間判断待ち
  - AI は「軽微だから OK」と勝手に Ready 切替しない

> ⚠️ **タイトル更新 → Ready 切替の順序**を厳守。`ready_for_review` イベント発火時点で
> タイトルが既に更新済 → claude-review が通常 prompt で起動する。順序が逆だと空コミットが必要。

### Phase 5: FB 集約 + マージ [AI 集約、人間がマージ]

- skill: `/wrap-issue <NNN>`
- PR の最終レビュー (Bot + 人間) コメントを `review.md` に集約
- コミット: `docs(<NNN>): Phase 5 review.md 集約`
- 「skill / CLAUDE.md / 規約に落とすべき学び」を抽出
  - 判断軸:
    - **3 回以上同じ FB が出ている** → ルール化候補
    - **どのプロジェクトでも当てはまる** → グローバル `~/.claude/CLAUDE.md` または `~/.claude/skills/`
    - **factrail 固有** → プロジェクトの `CLAUDE.md` または `.claude/skills/`
    - **単発の判断・履歴** → `review.md` に蓄積のみ
- 必要があれば別 PR で skill / ドキュメントを更新
- **マージは人間が実施**（AI は勝手にマージしない）

## PR 状態と Phase の対応

| Phase | PR 状態 | 切替主体 |
| --- | --- | --- |
| 1. 詳細設計 | **Draft** | `/start-issue` がドラフト PR を作成 |
| 1.5. 設計レビュー | Draft のまま | AI が修正コミット |
| 2. 実装 | Draft のまま | — |
| 3. 検証 | Draft のまま | `/verify-issue` 進行 |
| **4. PR Open** | **Ready** へ | **`/verify-issue` が全 PASS 後に自動 `gh pr ready`** |
| 5. FB 集約・マージ | Ready | 人間が approve → マージ |

## マージ方式

- **Create a merge commit**: 標準。Phase 別 commit を main 履歴に残せる
- **Rebase and merge**: 可。同様に Phase 別 commit が残る
- **Squash and merge**: ❌ 使用しない
  - 設計→FB反映→実装→検証 の Phase 別 commit が消えてしまう
  - cherry-pick が必要な workflow 変更系では履歴重複の原因にもなる

## コミットメッセージ規約

### Bot/AI 応答コミット（Issue サイクル内）— Issue 番号 scope を使う

| Phase | フォーマット | 例 |
| --- | --- | --- |
| 1 | `docs(<NNN>): Phase 1 詳細設計を起こす (<簡潔な内容>)` | `docs(151): Phase 1 詳細設計を起こす (claude-review.yml YAML 安全化)` |
| 1.5 | `docs(<NNN>): Phase 1 設計レビュー FB を反映` | 同左 |
| 2 | `feat(<NNN>): Phase 2 実装 - <概要>` または `fix(<NNN>): ...` | `fix(151): Phase 2 実装 - claude-code-review.yml の YAML 安全化` |
| 3 | `chore(<NNN>): Phase 3 検証エビデンス追加` | 同左 |
| 5 | `docs(<NNN>): Phase 5 review.md 集約` | 同左 |

### 通常のドメインコミット（Issue 紐付けなし or 横断）— ドメイン scope を使う

| 例 | 用途 |
| --- | --- |
| `feat(facts): GET /api/facts にページネーション機能を追加` | Facts ドメインの機能追加 |
| `fix(webhooks): GitHub Webhook の署名検証エラーを修正` | Webhooks ドメインのバグ修正 |
| `refactor(integrations): トークン暗号化処理を共通化` | Integrations ドメインのリファクタ |

**使い分け基準**:
- Issue サイクル (Phase 1〜5) で生まれるコミット → `<NNN>` 番号 scope
- Issue 横断 / ドメイン横断 / Hot fix → ドメイン scope（`facts`, `webhooks`, `integrations` 等）
- 詳細: `.claude/instructions.md`「コミットメッセージ」セクション参照

## workflow 変更時の運用

`.github/workflows/*` を変更する PR は claude-code-action の **「main ブランチと完全一致」検証**があるため、以下の順序で進める:

```
1. PR ブランチで workflow 変更コミット
2. main へ cherry-pick
3. main へ git push origin main
4. ⏰ ~30 秒待機 (GitHub の workflow ref 反映が安定するまで)
5. PR ブランチで空コミット or 次の変更を push (CI が新 main を見て validation 通過)
```

`permission denied` で main 直接 push が拒否される場合は別 PR (workflow 1 ファイルのみ) を先にマージする運用に切替。

## 規約: PR/Issue コメントでの Bot 参照

`@claude` メンション付きのコメントを **人間 / AI が投稿すると** `claude.yml` workflow が trigger され、`claude-code-review.yml` の通常レビューと並行して **2 重 review** が走る。これを避けるため:

- ❌ `@claude のレビュー指摘 9 件...`
- ✅ `` `claude-review` のレビュー指摘 9 件... `` （バッククォート囲み）
- ✅ `claude[bot] の指摘 ...`
- ✅ `Bot レビュー ...`

例外: PR タイトルや本文で **意図的に Bot を起動したい**場合のみ `@claude` を生で書く（例: `@claude fix this`）

## skill 一覧（本サイクル専用）

| skill | Phase | 責務 |
| --- | --- | --- |
| `/start-issue <NNN>` | 1 | 詳細設計の起点を作る + ドラフト PR 作成 |
| `/verify-issue <NNN>` | 3, 4 | test-plan の消化 + 全 PASS で Ready 切替 |
| `/wrap-issue <NNN>` | 5 | レビュー FB を集約・ナレッジ昇華 |

## 補足

- 軽微な修正（typo・依存更新など）は本サイクルを省略してもよい。判断は AI が提案 → ユーザー承認。
- 過去の Issue を後追いで `docs/issues/<NNN>-<slug>/` に起こす場合、`assets/` のみで `README.md` は簡略化してよい（例: `143-ui-redesign/`）。
