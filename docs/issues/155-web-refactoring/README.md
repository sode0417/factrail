# #155 [WEB]リファクタリング

> GitHub Issue: https://github.com/sode0417/factrail/issues/155
> ブランチ: `claude/issue-155-20260509-0841`
> ステータス: 設計中

## 要件 (Issue から展開)

Web (Next.js) のディレクトリ構成に違和感があり、ベストプラクティスに基づいて見直したい。

**現状の課題:**
- `lib/` と `utils/` の 2 つのユーティリティディレクトリが共存しており、役割の境界が曖昧
  - `lib/`: axios.ts, dateUtils.ts, factUtils.ts, formatRelativeTime.ts
  - `utils/`: oauth.ts（1 ファイルのみ）
- フィーチャーごとのコードが複数ディレクトリに分散している
  - `components/facts/` にコンポーネントがあるが、関連する hooks・types は別ディレクトリに分離
  - `hooks/useDateFilter.ts` は facts フィーチャー専用だが hooks/ 直下に置かれている
- `types/fact.ts` が 1 ファイルのみで types/ を作っているが、将来的な拡張性は考慮されている

**現在のディレクトリ構成:**
```
src/
├── app/                    # Next.js App Router ページ
│   ├── auth/callback/
│   ├── facts/
│   ├── login/
│   └── setup/github|slack/
├── components/
│   ├── auth/
│   ├── facts/ (+ detail/)
│   └── layout/
├── hooks/
│   └── useDateFilter.ts
├── lib/
│   ├── axios.ts
│   ├── dateUtils.ts
│   ├── factUtils.ts
│   └── formatRelativeTime.ts
├── stores/
│   └── authStore.ts
├── types/
│   └── fact.ts
└── utils/
    └── oauth.ts
```

## 受入条件

- [ ] `lib/` と `utils/` の役割が明確に分離されている（または統合されている）
- [ ] フィーチャー固有のコード（コンポーネント・フック・型）が同一ディレクトリに集約されている（feature-based organization）
- [ ] 移動後も全ページが正常に動作する（ビルドエラーなし）
- [ ] import パスが更新され、TypeScript コンパイルエラーがない
- [ ] 既存機能（Facts 一覧・ログイン・OAuth 設定）に回帰がない

## スコープ外

- `app/` ディレクトリ内の page.tsx のロジック変更（ルーティング構成は変えない）
- 新機能の追加
- スタイリングの変更
- API 側のリファクタリング

## 設計サマリー

### 採用方針: **Feature-based Organization（フィーチャー別整理）**

`features/` ディレクトリを導入し、フィーチャー固有のコンポーネント・フック・型を集約する。
グローバルなユーティリティは `lib/` に統合し、`utils/` は廃止する。

**提案する新ディレクトリ構成:**
```
src/
├── app/                        # Next.js ルーティングのみ（変更なし）
├── components/                 # グローバル共通コンポーネント
│   └── layout/                 # Header, Sidebar, MainLayout
├── features/                   # フィーチャー別コード
│   ├── facts/                  # 記録フィーチャー
│   │   ├── components/         # ← 旧 components/facts/
│   │   │   └── detail/
│   │   ├── hooks/              # ← 旧 hooks/useDateFilter.ts
│   │   └── types/              # ← 旧 types/fact.ts
│   └── auth/                   # 認証フィーチャー
│       ├── components/         # ← 旧 components/auth/
│       └── stores/             # ← 旧 stores/authStore.ts
├── lib/                        # サードパーティ設定 + 汎用ユーティリティ
│   ├── axios.ts
│   ├── dateUtils.ts
│   ├── factUtils.ts
│   ├── formatRelativeTime.ts
│   └── oauth.ts                # ← 旧 utils/oauth.ts を統合
└── (utils/ を廃止)
```

**理由:**
- フィーチャーごとのコードが一箇所に集まり、変更範囲が局所化される
- `lib/` はサードパーティ設定・汎用ユーティリティに統一し `utils/` を廃止することで迷いがなくなる
- auth 関連 (AuthGuard, authStore) を `features/auth/` にまとめることで凝集度が上がる

**`factUtils.ts` を `lib/` に残す理由:**
`factUtils.ts` は source 文字列 (`"github"`, `"slack"` 等) を UI 表示値（色・ラベル）に変換するプレゼンテーション層のユーティリティ。`Fact` 型への直接依存がなく、将来的に複数フィーチャーから参照される可能性があるため、汎用ユーティリティとして `lib/` に留める。feature-based に徹して `features/facts/utils/` へ移動することも可能だが、今回はスコープを絞り `lib/` 配置を採用する。

## 影響範囲

| エリア | ファイル / モジュール | 変更概要 |
| --- | --- | --- |
| Web | `src/components/facts/*` | `src/features/facts/components/` に移動 |
| Web | `src/components/auth/*` | `src/features/auth/components/` に移動 |
| Web | `src/hooks/useDateFilter.ts` | `src/features/facts/hooks/` に移動 |
| Web | `src/types/fact.ts` | `src/features/facts/types/` に移動 |
| Web | `src/stores/authStore.ts` | `src/features/auth/stores/` に移動 |
| Web | `src/utils/oauth.ts` | `src/lib/oauth.ts` に移動（utils/ 廃止） |
| Web | `src/app/providers.tsx` | `@/components/auth/AuthGuard` → `@/features/auth/components/AuthGuard` |
| Web | `src/app/facts/page.tsx` | `@/components/facts`, `@/hooks/useDateFilter`, `@/types/fact` → `@/features/facts/*` |
| Web | `src/app/auth/callback/page.tsx` | `@/stores/authStore` → `@/features/auth/stores/authStore` |
| Web | `src/app/login/page.tsx` | `@/stores/authStore` → `@/features/auth/stores/authStore` |

## 関連リンク

- 設計シーケンス: [sequence.md](./sequence.md)
- テスト計画: [test-plan.md](./test-plan.md)
- レビュー記録: [review.md](./review.md)
- アセット: [assets/](./assets/)
