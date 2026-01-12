---
title: Factrail｜API仕様書
type: private
status: Active
date: 2025-12-29
tags: [project, factrail, api, specification]
related: [[Factrail（Fact Trail）]]
---

# Factrail API 仕様書

## Base URL

- Development: `http://localhost:3001/api`
- Production: `https://factrail-api.railway.app/api`

---

## 認証

初期実装では認証なし（localhost or Basic認証で保護）

将来実装:
```
Authorization: Bearer {token}
```

---

## Endpoints

### Facts

#### GET /api/facts

Facts の一覧取得

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| source | string | No | ソースでフィルタ (github, slack, etc) |
| type | string | No | タイプでフィルタ |
| from | ISO 8601 | No | 開始日時 |
| to | ISO 8601 | No | 終了日時 |
| limit | number | No | 取得件数 (default: 50, max: 100) |
| cursor | string | No | ページネーション用カーソル |

**Response:**
```json
{
  "data": [
    {
      "id": "clpqr...",
      "externalId": "octocat/hello#123",
      "source": "github",
      "sourceUrl": "https://github.com/octocat/hello/issues/123",
      "occurredAt": "2025-12-29T10:00:00Z",
      "title": "Fix authentication bug",
      "summary": "Authentication fails when...",
      "type": "issue.created",
      "metadata": {
        "repository": "octocat/hello",
        "number": 123,
        "labels": ["bug", "high-priority"]
      },
      "createdAt": "2025-12-29T10:00:00Z"
    }
  ],
  "meta": {
    "hasMore": true,
    "nextCursor": "clpqs..."
  }
}
```

#### GET /api/facts/:id

特定の Fact 取得

**Response:**
```json
{
  "data": {
    "id": "clpqr...",
    "externalId": "octocat/hello#123",
    "source": "github",
    "sourceUrl": "https://github.com/octocat/hello/issues/123",
    "occurredAt": "2025-12-29T10:00:00Z",
    "title": "Fix authentication bug",
    "summary": "Authentication fails when...",
    "content": "Detailed description...",
    "raw": { /* 元データ完全保存 */ },
    "type": "issue.created",
    "metadata": { /* ... */ },
    "slackMessageId": "1234567890.123456",
    "createdAt": "2025-12-29T10:00:00Z",
    "processedAt": "2025-12-29T10:00:01Z"
  }
}
```

#### POST /api/facts

手動で Fact を作成

**Request Body:**
```json
{
  "source": "manual",
  "title": "Important meeting notes",
  "content": "Discussed Q1 goals...",
  "type": "note",
  "occurredAt": "2025-12-29T10:00:00Z",
  "metadata": {
    "tags": ["meeting", "planning"]
  }
}
```

---

### Integrations

#### GET /api/integrations

連携一覧取得

**Response:**
```json
{
  "data": [
    {
      "id": "clpqr...",
      "provider": "github",
      "accountId": "octocat",
      "accountName": "The Octocat",
      "status": "active",
      "scope": ["repo", "read:user"],
      "lastSyncAt": "2025-12-29T10:00:00Z",
      "createdAt": "2025-12-20T10:00:00Z"
    }
  ]
}
```

#### DELETE /api/integrations/:id

連携を削除

**Response:**
```json
{
  "success": true
}
```

---

### Webhooks

#### POST /webhooks/github

GitHub Webhook 受信エンドポイント

**Headers:**
```
X-Hub-Signature-256: sha256=...
X-GitHub-Event: issues
```

**Request Body:**

GitHub Webhook ペイロード

**Response:**
```json
{
  "success": true,
  "factId": "clpqr..."
}
```

---

### F2A 連携

#### GET /api/facts/export/f2a

F2A Event 形式でエクスポート

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| since | ISO 8601 | No | この日時以降のFactsを取得 |
| excludeImported | boolean | No | F2Aに取り込み済みを除外 (default: true) |

**Response:**
```json
{
  "data": [
    {
      "content": "Fix authentication bug",
      "event_type": "github_issue",
      "payload": {
        "fact_id": "clpqr...",
        "source": "github",
        "repository": "octocat/hello",
        "issue_number": 123
      },
      "occurred_at": "2025-12-29T10:00:00Z",
      "external_id": "fact_clpqr..."
    }
  ],
  "meta": {
    "count": 10,
    "since": "2025-12-29T00:00:00Z"
  }
}
```

#### POST /api/facts/mark-imported

F2A 取り込み済みをマーク

**Request Body:**
```json
{
  "factIds": ["clpqr...", "clpqs..."],
  "f2aEventIds": ["01ABC...", "01DEF..."]
}
```

---

### Health Check

#### GET /health

ヘルスチェック

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-29T10:00:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "slack": "healthy",
    "github": "healthy"
  }
}
```

---

## Error Responses
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "source": "Must be one of: github, slack, manual"
    }
  }
}
```

**Error Codes:**

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | リクエスト形式エラー |
| NOT_FOUND | 404 | リソースが見つからない |
| RATE_LIMIT | 429 | Rate Limit 超過 |
| INTERNAL_ERROR | 500 | サーバーエラー |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| GET /api/facts | 100 req/min |
| POST /api/facts | 10 req/min |
| POST /webhooks/* | 1000 req/min |

---

## Webhook Security

### GitHub

署名検証:
```typescript
const signature = req.headers['x-hub-signature-256'];
const payload = JSON.stringify(req.body);
const expectedSignature = `sha256=${crypto
  .createHmac('sha256', GITHUB_WEBHOOK_SECRET)
  .update(payload)
  .digest('hex')}`;
  
if (signature !== expectedSignature) {
  throw new UnauthorizedException();
}
```

---

## 今後の拡張予定

- WebSocket サポート（リアルタイム配信）
- GraphQL エンドポイント
- Batch API（複数Facts一括作成）
- 集計・分析エンドポイント