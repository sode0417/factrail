# シーケンス設計

主要な処理フローを Mermaid で記述する。
複数フローがあるなら見出しで分ける（"成功系" / "エラー系" / "リトライ系" など）。

## 全体フロー

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant Web as Next.js (apps/web)
  participant API as NestJS (apps/api)
  participant DB as PostgreSQL
  participant Ext as External (GitHub/Slack/F2A)

  User->>Web: 操作
  Web->>API: POST /endpoint
  API->>DB: query
  DB-->>API: result
  API-->>Web: response
  Web-->>User: UI 更新
```

## 補足

- 認証: <!-- JWT / Cookie / API Key のどれを使うか -->
- 副作用: <!-- 外部呼び出し、Webhook、Queue など -->
- 失敗時: <!-- リトライ・補償・通知 -->
