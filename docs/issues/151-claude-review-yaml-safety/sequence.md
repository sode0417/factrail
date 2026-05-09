# シーケンス設計

本 Issue はランタイム処理フローの変更ではなく、**workflow の安全反映プロセス**を扱う。
そのため、コードのシーケンスではなく **PR マージまでの workflow 変更フロー**を Mermaid で記述する。

## workflow 変更の安全反映フロー

```mermaid
sequenceDiagram
  autonumber
  actor Dev as 開発者 (AI)
  participant PRBranch as PR ブランチ<br/>chore/151-...
  participant Main as main ブランチ
  participant CI as claude-code-action<br/>(GitHub Actions)
  participant Review as claude-review<br/>(Bot)

  Dev->>PRBranch: workflow 修正コミット<br/>(claude_args, id-token コメント)
  Dev->>PRBranch: git push
  PRBranch->>CI: trigger pull_request
  CI->>CI: workflow validation<br/>(main と PR の workflow を比較)
  CI-->>PRBranch: ❌ FAIL (workflow validation failed)
  Note over CI,PRBranch: 想定された失敗 — main 完全一致制約

  alt main 直接 push が許可されている場合 (推奨)
    Dev->>Main: cherry-pick (chore: workflow 修正)
    Dev->>Main: git push origin main
    Note over Main: main と PR の workflow が一致
  else permission denied / 直接 push 不可の場合 (フォールバック)
    Dev->>Main: 別 PR (chore/151-workflow-only) を作成<br/>workflow 1 ファイルのみ
    Note over Main: 別 PR を先にマージ<br/>main と本 PR の workflow が一致
    Dev->>PRBranch: git pull origin main で取り込み
  end

  Dev->>PRBranch: 空コミット push (CI 再走)
  PRBranch->>CI: trigger pull_request
  CI->>CI: workflow validation
  CI-->>PRBranch: ✅ PASS (一致確認済み)
  CI->>Review: claude-review 実行
  Review-->>PRBranch: コメント投稿<br/>(誤指摘 2 件が再発しないことを確認)

  Dev->>Main: PR マージ (merge or rebase 推奨)
```

## 補足

- 認証: `id-token: write` 権限で OIDC → GitHub App token 交換（変更後も同じ挙動）
- 副作用: 本 Issue ではなし。ランタイムロジック未変更
- 失敗時の戻し方: workflow を main の元の状態に戻す revert PR を作成すれば即座に復旧
- main 直接 push 制約: harness の permission rule で禁止される場合があるため、permission の遅延評価で拒否される可能性に注意。事前にユーザー許可を取る。拒否時はシーケンス図の `else` 分岐（別 PR 戦略）に切り替える

## マージ方式の注意

cherry-pick + **squash** マージを使うと、同一内容のコミットが main の履歴に 2 つ残ります（cherry-pick 由来のコミット + squash マージコミット）。これを避けるため:

- **推奨**: マージ方式は **merge** または **rebase** を使う
- **squash を使う場合**: 別 PR 戦略（`else` 分岐）を選ぶ。cherry-pick が不要になるため履歴が綺麗になる

GitHub の PR マージ画面で「Create a merge commit」「Rebase and merge」「Squash and merge」のうち、本 Issue では**前者 2 つ**を推奨。
