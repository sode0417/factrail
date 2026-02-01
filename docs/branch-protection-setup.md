# Branch Protection Rules 設定ガイド

## 概要

このドキュメントでは、mainブランチを保護し、PR時に必須チェックを実行するためのBranch Protection Rulesの設定方法を説明します。

## 前提条件

- GitHubリポジトリの管理者権限
- CI/CDワークフローが正常に動作していること

## 設定手順

### 1. Branch Protection Rulesへアクセス

1. GitHubリポジトリのページを開く
2. **Settings** タブをクリック
3. 左側メニューから **Branches** を選択
4. **Branch protection rules** セクションで **Add branch protection rule** をクリック

### 2. 保護するブランチを指定

**Branch name pattern** に `main` と入力

### 3. 必須設定項目

#### ✅ Require a pull request before merging

- [x] **Require a pull request before merging**
  - mainブランチへの直接pushを禁止
  - PRを通じてのみマージ可能にする

オプション設定：
- [ ] Require approvals: 必要に応じて承認者数を設定（推奨: 1）
- [ ] Dismiss stale pull request approvals when new commits are pushed

#### ✅ Require status checks to pass before merging

- [x] **Require status checks to pass before merging**
  - CI/CDのチェックが全てパスするまでマージを禁止

- [x] **Require branches to be up to date before merging**
  - マージ前にブランチが最新であることを要求

**Status checks that are required（必須チェック項目）:**

以下のステータスチェックを検索して追加：

##### API関連
- `api-tests` - APIのユニット・E2Eテスト + カバレッジチェック
- `api-ci` - APIのTypeScript/ESLint/Buildチェック

##### Web関連
- `web-e2e` - WebのE2Eテスト（Playwright）
- `web-ci` - WebのTypeScript/ESLint/Buildチェック

##### セキュリティ
- `NPM Audit (api)` - API依存関係の脆弱性チェック
- `NPM Audit (web)` - Web依存関係の脆弱性チェック
- `Snyk Security Scan (api)` - APIのSnykスキャン
- `Snyk Security Scan (web)` - WebのSnykスキャン
- `Trivy Security Scan` - ファイルシステム・IaCスキャン

#### ✅ その他の推奨設定

- [x] **Require conversation resolution before merging**
  - レビューコメントが全て解決されるまでマージを禁止

- [ ] **Require signed commits**（オプション）
  - 署名付きコミットを要求（必要に応じて）

- [ ] **Require linear history**（オプション）
  - マージコミットを禁止し、リニアな履歴を維持

- [x] **Do not allow bypassing the above settings**
  - 管理者でも上記ルールをバイパスできないようにする（推奨）

### 4. 設定を保存

**Create** または **Save changes** をクリックして設定を保存

## 設定後の確認

### 1. PRを作成してチェック項目を確認

新しいPRを作成し、以下が表示されることを確認：
- すべてのステータスチェックが実行される
- チェックがパスするまでマージボタンが無効化される

### 2. ステータスチェックの確認方法

PRページで以下を確認：
```
✅ api-tests
✅ api-ci
✅ web-e2e
✅ web-ci
✅ NPM Audit (api)
✅ NPM Audit (web)
✅ Snyk Security Scan (api)
✅ Snyk Security Scan (web)
✅ Trivy Security Scan
✅ Security Summary
```

## トラブルシューティング

### チェック項目が表示されない

1. 該当するワークフローが少なくとも1回実行されているか確認
2. ワークフローのジョブ名とステータスチェック名が一致しているか確認
3. `on.pull_request` トリガーが設定されているか確認

### カバレッジチェックで失敗する

- API: カバレッジが80%未満の場合は修正が必要
- コマンド: `npm run test:cov` でローカル確認

### セキュリティスキャンで失敗する

- 高/致命的脆弱性が検出されている
- issue #65 を参照して脆弱性を修正
- または、ワークフローを調整して本番依存関係のみをスキャン

## CI/CDワークフロー一覧

| ワークフロー | 説明 | トリガー |
|------------|------|---------|
| `ci-api.yml` | APIのTypeScript/ESLint/Build | PR, push to main |
| `ci-web.yml` | WebのTypeScript/ESLint/Build | PR, push to main |
| `test-api.yml` | APIのテスト + カバレッジ | PR, push to main |
| `test-web.yml` | WebのE2Eテスト | PR, push to main |
| `security.yml` | セキュリティスキャン | PR, push to main, 週次 |
| `claude.yml` | Claude自動応答 | issue作成 |
| `claude-code-review.yml` | Claudeコードレビュー | PR作成 |
| `auto-label-issues.yml` | Issue自動ラベル付け | issue作成 |
| `docs-update-on-merge.yml` | ドキュメント自動更新 | PR merge |

## 参考資料

- [GitHub - Branch protection rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub - Status checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks)
