# テスト計画

`README.md` の受入条件と整合させる。`/verify-issue` がこのチェックリストを順に消化する。

## 自動テスト

| 種別 | 対象 | 期待挙動 | ファイル |
| --- | --- | --- | --- |
| Build | Next.js 全体 | `next build` がエラーなく完了する | `apps/web/` |
| Type Check | TypeScript | `tsc --noEmit` がエラーなく完了する | `apps/web/` |

## 手動検証

- [ ] **ビルド確認**: `cd apps/web && npm run build` でエラーが発生しない
- [ ] **型チェック**: `cd apps/web && npx tsc --noEmit` でエラーが発生しない
- [ ] **Facts 一覧ページ**: `/facts` ページが正常に表示される（コンポーネントが壊れていない）
- [ ] **ログインページ**: `/login` ページが正常に表示される（AuthGuard が機能する）
- [ ] **GitHub 連携設定**: `/setup/github` ページが正常に表示される
- [ ] **Slack 連携設定**: `/setup/slack` ページが正常に表示される
- [ ] **OAuth コールバック**: `/auth/callback` のルーティングが正常に機能する
- [ ] **lint チェック**: `cd apps/web && npm run lint` でエラーが発生しない

## 非機能・回帰

- [ ] 既存機能が壊れていない (smoke): 全ページが HTTP 200 を返す
- [ ] `@/` パスエイリアスが正しく解決されている（tsconfig.json の paths 設定が有効）
- [ ] バレルエクスポート (`index.ts`) が正しく機能している

## 検証エビデンス

スクショ・録画は `assets/` に置き、ファイル名で対応シナリオがわかるようにする。

| シナリオ | エビデンス |
| --- | --- |
| ビルド成功 | `assets/build-success.txt` |
| 型チェック成功 | `assets/tsc-output.txt` |
