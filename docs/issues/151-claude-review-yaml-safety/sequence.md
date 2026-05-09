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

  Dev->>Main: cherry-pick (chore: workflow 修正)
  Dev->>Main: git push origin main
  Note over Main: main と PR の workflow が一致

  Dev->>PRBranch: 空コミット push (CI 再走)
  PRBranch->>CI: trigger pull_request
  CI->>CI: workflow validation
  CI-->>PRBranch: ✅ PASS (一致確認済み)
  CI->>Review: claude-review 実行
  Review-->>PRBranch: コメント投稿<br/>(誤指摘 2 件が再発しないことを確認)

  Dev->>Main: PR マージ (squash)
```

## 補足

- 認証: `id-token: write` 権限で OIDC → GitHub App token 交換（変更後も同じ挙動）
- 副作用: 本 Issue ではなし。ランタイムロジック未変更
- 失敗時の戻し方: workflow を main の元の状態に戻す revert PR を作成すれば即座に復旧
- main 直接 push 制約: harness の permission rule で禁止される場合があるため、`gh secret list` 風の遅延評価で拒否される可能性に注意。事前にユーザー許可を取る
