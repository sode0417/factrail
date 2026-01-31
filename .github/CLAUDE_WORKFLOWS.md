# Claude Code Workflows ガイド

Factrailプロジェクトでは、Claude Codeを活用した自動レビュー・修正ワークフローを導入しています。

## 🤖 利用可能なワークフロー

### 1. 自動コードレビュー（claude-code-review.yml）

**トリガー**: PRが作成・更新されたとき

**動作**:
- コード品質のフィードバック
- セキュリティ考慮事項の指摘
- テストカバレッジの分析
- パフォーマンスへの影響評価
- 改善提案

**使い方**:
PRを作成すると自動的に実行されます。レビュー結果はPRのコメントとして投稿されます。

---

### 2. CI Summary & 自動修正（ci-summary.yml）

**トリガー**: すべてのCI/テストワークフローが完了したとき

**動作**:
1. いずれかのCI/テストワークフローが完了したらトリガー
2. 30秒待機して他のワークフローの完了を待つ
3. すべてのワークフロー（API CI, Web CI, API Tests, Web E2E Tests）の状態を確認
4. **すべて完了 & 失敗がある場合のみ**、Claudeが自動修正を実行
5. すべての失敗ログを分析して一括修正
6. 修正内容をコミット
7. PRにコメントで報告

**メリット**:
- 個別のCI失敗ごとに反応せず、すべて完了後に1回だけ実行
- すべてのエラーを一度に確認して効率的に修正
- 重複した修正や競合を防止

**注意**: 自動コミットが行われるため、コミット履歴を確認してください。

---

### 3. 手動修正（auto-fix.yml）

#### コメントでの手動修正

**トリガー**: PRコメントで `@claude fix` または `@claude auto-fix`

**使い方**:
```
@claude fix lint errors in src/app.ts
```

または
```
@claude auto-fix
```

**動作**:
1. コメント内容を分析
2. 関連するCI結果を確認
3. 指摘された問題を修正
4. 変更をコミット
5. コメントに🚀リアクション

**例**:
- `@claude fix` - 全般的な問題を自動修正
- `@claude fix lint` - Lint問題のみ修正
- `@claude fix tests` - テスト失敗を修正
- `@claude fix this function` - 特定箇所の修正

---

### 4. 汎用Claude Code（claude.yml）

**トリガー**:
- コメントで `@claude` をメンション
- `claude:auto` ラベルが付いたissue

**使い方**:
```
@claude この関数をリファクタリングしてください
```

```
@claude テストカバレッジを80%まで上げてください
```

**動作**:
自由形式の指示に従ってコード作成・修正を行います。

---

## 📋 使用例

### 例1: PRのレビューと修正

1. PRを作成
   → 自動レビューが実行される

2. レビューで問題が指摘される
   ```
   🔴 CRITICAL: SQL injection vulnerability in line 42
   💡 Suggestion: Use parameterized queries
   ```

3. 自動修正を依頼
   ```
   @claude fix the SQL injection issue
   ```

4. Claudeが修正をコミット
   → CIが再実行され、問題が解決

### 例2: CI失敗からの自動復旧

1. PRをプッシュ

2. 複数のCI/テストが失敗
   ```
   ❌ API CI: ESLint errors
   ❌ Web CI: TypeScript errors
   ❌ API Tests: 2 tests failed
   ✅ Web E2E Tests: Passed
   ```

3. すべてのワークフローが完了
   → CI Summaryワークフローが起動

4. Claudeがすべての失敗ログを確認
   → すべての問題を一度に修正

5. 修正がコミットされ、CIが再実行

### 例3: 特定の改善依頼

```
@claude fix この関数のパフォーマンスを改善してください:

function calculateTotal(items) {
  // 遅い実装
}
```

---

## ⚙️ 設定

### 必要なシークレット

- `CLAUDE_CODE_OAUTH_TOKEN`: Claude Code OAuth トークン
  - 設定場所: Settings → Secrets and variables → Actions

### 権限設定

以下の権限が必要です（ワークフローファイルで自動設定）:
- `contents: write` - コミット権限
- `pull-requests: write` - PRへのコメント
- `issues: write` - Issueへのコメント
- `actions: read` - CI結果の読み取り

### ブランチ保護ルール

自動コミットを許可する場合、Branch Protection Rulesで以下を設定:
- "Require pull request reviews before merging" をオフ（またはbotを除外）
- "Include administrators" の考慮

---

## 🚨 注意事項

### 1. 自動コミットのレビュー

Claudeが自動コミットした変更は、必ず人間がレビューしてください:
- セキュリティ上の問題がないか
- 意図した修正になっているか
- 不要な変更が含まれていないか

### 2. 無限ループ防止

自動修正が失敗を繰り返す場合、手動で介入してください。

### 3. コスト管理

Claude Code APIの使用量に注意してください。頻繁なPR更新で予期しないコストが発生する可能性があります。

### 4. プライバシー

Claude Codeはコードとコメントを分析します。機密情報が含まれないように注意してください。

---

## 🔧 トラブルシューティング

### Claudeが反応しない

- `CLAUDE_CODE_OAUTH_TOKEN`が正しく設定されているか確認
- ワークフローのトリガー条件を確認（`@claude`のメンションが正しいか等）

### 自動コミットが失敗する

- `contents: write`権限があるか確認
- ブランチ保護ルールを確認
- `GITHUB_TOKEN`の権限を確認

### CI失敗が自動修正されない

- CI Summaryワークフローのログを確認（Actions → CI Summary）
- すべてのワークフローが完了しているか確認
- 対象ワークフロー名が一致しているか確認（ci-summary.ymlの`targetWorkflows`配列）
- 30秒の待機時間が十分か確認（遅いワークフローがある場合は調整）

### 自動修正が複数回実行される

- CI Summaryワークフローを使用していることを確認
- 古いauto-fix.ymlの`auto-fix-ci-failures`ジョブが削除されているか確認

---

## 📚 参考リンク

- [Claude Code 公式ドキュメント](https://code.claude.com/docs)
- [claude-code-action](https://github.com/anthropics/claude-code-action)
- [GitHub Actions ドキュメント](https://docs.github.com/en/actions)

---

## 💡 ベストプラクティス

1. **小さなPRを作成**: 大きな変更は分割してレビューしやすくする
2. **明確な指示**: `@claude fix`より`@claude fix lint errors in auth.ts`の方が効果的
3. **段階的な導入**: まず手動トリガー（`@claude fix`）から始め、慣れたら自動修正を有効化
4. **ログの確認**: Claudeの動作をActions logsで確認し、改善点を見つける

---

## 🔄 更新履歴

- 2026-01-31 (v2): CI Summaryワークフローの追加
  - すべてのCI/テスト完了後に1回だけ自動修正を実行
  - 複数のワークフロー失敗時の重複実行を防止
  - より効率的な修正フロー

- 2026-01-31 (v1): 初版作成
  - 自動レビューワークフロー
  - 自動修正ワークフロー（CI失敗時、コメント時）
  - 汎用Claudeワークフロー
