# #143 Web UI デザインの刷新（配色・ビジュアル改善）

> GitHub Issue: https://github.com/sode0417/factrail/issues/143
> 関連 PR: [#146](https://github.com/sode0417/factrail/pull/146) (`d28681d`), [#143](https://github.com/sode0417/factrail/pull/143) (`a941b40`)
> ステータス: マージ済み（2026-04-19 クローズ）

## 概要（過去分・簡易記録）

本 Issue は本サイクル規約（`docs/issues/README.md`）導入前に完了済みのため、`assets/` のスクリーンショット・モックアップのみ後追いで移設している。設計・受入条件・テスト計画の詳細は GitHub Issue / PR を参照。

## 主要な決定

- 温かみのあるカラーパレット（natural green）を採用 (`mockup-01-natural-green-v3.png`)
- ロゴ刷新 + 透過版を最終採用 (`mockup-07-v29-logo-transparent.png`)
- 固定レイアウト + サイドバー + L 字シェル (`mockup-07-v21-L-shape-top.png`)
- モバイルでフィルター折りたたみ (`mockup-01-mobile.png`)

## アセット

- [`assets/2026-04-19/`](./assets/2026-04-19/) — 初期 Web スクショ (01-landing 〜 07-facts-mobile) + 採用案 (mockup-01-natural-green-v3, mockups-index) + インタラクティブ mockup HTML (01, 07)
- [`assets/2026-05-09/`](./assets/2026-05-09/) — 最終採用形のみ (mockup-07-v29-logo-transparent)

採用版ロゴは `apps/web/public/logo/{symbol,wordmark}.png` にリポジトリ本体として存在。
不採用案・中間試行は PR #150 で削除済み。git 履歴で参照可能。

## 後続課題

- なし（モバイル UX 改善は別 Issue / `a941b40` で対応済み）
