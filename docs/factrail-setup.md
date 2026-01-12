---
title: Factrail｜環境構築手順書
type: private
status: Active
date: 2025-12-29
tags: [project, factrail, setup]
related: [[Factrail（Fact Trail）]]
---

# Factrail 環境構築手順書

## 前提条件

- Node.js 18+ インストール済み
- F2Aプロジェクトで使用中のSupabaseプロジェクト
- GitHub アカウント
- Slack ワークスペース管理権限

---

## 1. Supabase セットアップ

### 1.1 F2Aと同じプロジェクトを使用

F2Aプロジェクトで使用しているSupabaseプロジェクトを共有します。

**必要な認証情報（F2Aから取得）:**
- Project URL
- service_role key（RLSバイパス用）
- Database接続文字列

### 1.2 Factrail用スキーマ作成

Supabase Dashboard → SQL Editor で以下を実行：
```sql
-- Factrail専用スキーマ作成
CREATE SCHEMA IF NOT EXISTS factrail;

-- スキーマ権限設定
ALTER SCHEMA factrail OWNER TO postgres;
GRANT ALL ON SCHEMA factrail TO postgres;
GRANT USAGE ON SCHEMA factrail TO anon, authenticated, service_role;

-- UUID拡張（必要な場合）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 1.3 Factrailテーブル作成
```sql
-- Facts テーブル
CREATE TABLE factrail.facts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  external_id TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  raw JSONB NOT NULL,
  
  type TEXT NOT NULL,
  metadata JSONB,
  
  slack_message_id TEXT UNIQUE,
  f2a_event_id CHAR(26) UNIQUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  
  UNIQUE(source, external_id)
);

-- インデックス
CREATE INDEX idx_facts_occurred_at ON factrail.facts(occurred_at DESC);
CREATE INDEX idx_facts_type ON factrail.facts(type);
CREATE INDEX idx_facts_source ON factrail.facts(source);
CREATE INDEX idx_facts_f2a_event_id ON factrail.facts(f2a_event_id);

-- Integrations テーブル
CREATE TABLE factrail.integrations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  provider TEXT NOT NULL,
  account_id TEXT NOT NULL,
  account_name TEXT,
  
  access_token TEXT NOT NULL, -- 暗号化済み
  refresh_token TEXT,         -- 暗号化済み
  expires_at TIMESTAMPTZ,
  scope TEXT[],
  
  status TEXT DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(provider, account_id)
);

-- 更新時刻自動更新トリガー
CREATE OR REPLACE FUNCTION factrail.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON factrail.integrations
  FOR EACH ROW
  EXECUTE FUNCTION factrail.update_updated_at();
```

### 1.4 F2A連携用ビュー（オプション）
```sql
-- F2A側から参照しやすいビュー
CREATE OR REPLACE VIEW public.factrail_pending_facts AS
SELECT 
  id as factrail_id,
  title as content,
  type,
  source,
  metadata as payload,
  occurred_at,
  created_at
FROM factrail.facts
WHERE f2a_event_id IS NULL
ORDER BY occurred_at DESC;

-- F2Aユーザーに読み取り権限
GRANT SELECT ON public.factrail_pending_facts TO authenticated;
```

---

## 2. リポジトリ構成
```bash
# リポジトリ作成
mkdir factrail
cd factrail
git init

# monorepo 構成
mkdir apps
mkdir packages
```

---

## 3. Backend (NestJS) セットアップ

### 3.1 NestJS プロジェクト作成
```bash
# NestJS CLI インストール
npm i -g @nestjs/cli

# API プロジェクト作成
cd apps
nest new api --package-manager npm
cd api

# 必要なパッケージインストール
npm install @nestjs/config @nestjs/throttler @nestjs/bull
npm install @prisma/client prisma
npm install bull bull-board
npm install bcrypt
npm install class-validator class-transformer
npm install @supabase/supabase-js

# 型定義
npm install -D @types/bcrypt
```

### 3.2 Prisma セットアップ
```bash
# Prisma 初期化
npx prisma init
```

### 3.3 prisma/schema.prisma
```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["factrail", "public"]
}

// Facts モデル
model Fact {
  id          String   @id @default(uuid())
  externalId  String   @map("external_id")
  source      String
  sourceUrl   String?  @map("source_url")
  occurredAt  DateTime @map("occurred_at")
  
  title       String
  summary     String?
  content     String?  @db.Text
  raw         Json
  
  type        String
  metadata    Json?
  
  slackMessageId String? @unique @map("slack_message_id")
  f2aEventId     String? @unique @map("f2a_event_id")
  
  createdAt   DateTime @default(now()) @map("created_at")
  processedAt DateTime? @map("processed_at")
  
  @@unique([source, externalId])
  @@index([occurredAt])
  @@index([type])
  @@index([source])
  @@index([f2aEventId])
  @@map("facts")
  @@schema("factrail")
}

// Integrations モデル
model Integration {
  id            String   @id @default(uuid())
  provider      String
  accountId     String   @map("account_id")
  accountName   String?  @map("account_name")
  
  accessToken   String   @map("access_token") @db.Text
  refreshToken  String?  @map("refresh_token") @db.Text
  expiresAt     DateTime? @map("expires_at")
  scope         String[]
  
  status        String   @default("active")
  lastSyncAt    DateTime? @map("last_sync_at")
  
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  
  @@unique([provider, accountId])
  @@map("integrations")
  @@schema("factrail")
}

// F2A Events参照用（読み取り専用）
model Event {
  id            String   @id
  userId        String   @map("user_id")
  content       String
  eventTypeId   String?  @map("event_type_id")
  payload       Json?
  occurredAt    DateTime @map("occurred_at")
  createdAt     DateTime @map("created_at")
  updatedAt     DateTime @map("updated_at")
  
  @@map("events")
  @@schema("public")
}
```

### 3.4 環境変数（.env）
```env
# Supabase (F2Aと同じプロジェクト)
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres?schema=factrail&pgbouncer=true"
DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres?schema=factrail"

# Supabase設定
SUPABASE_URL="https://[YOUR-PROJECT-REF].supabase.co"
SUPABASE_SERVICE_KEY="your-service-role-key"

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key-here

# Slack
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_REDIRECT_URI=http://localhost:3000/setup/slack/callback

# GitHub
GITHUB_WEBHOOK_SECRET=your-github-webhook-secret

# Redis (Railway Redis or local)
REDIS_URL=redis://localhost:6379

# API
API_PORT=3001
NODE_ENV=development
```

### 3.5 Prisma実行
```bash
# Prisma Clientを生成（マイグレーションはSupabaseで実行済み）
npx prisma generate

# スキーマをPrismaに同期（既存テーブルから）
npx prisma db pull

# 開発時はこれでDBの状態を確認
npx prisma studio
```

---

## 4. Frontend (Next.js) セットアップ

### 4.1 Next.js プロジェクト作成
```bash
cd apps
npx create-next-app@latest web --typescript --app --no-tailwind
cd web

# Chakra UI インストール
npm install @chakra-ui/react @emotion/react @emotion/styled framer-motion
npm install axios
npm install @supabase/supabase-js
```

### 4.2 環境変数（.env.local）
```env
# API
NEXT_PUBLIC_API_URL=http://localhost:3001

# Supabase (読み取り専用で使う場合)
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Basic Auth
BASIC_AUTH_USER=admin
BASIC_AUTH_PASSWORD=your-password-here
```

---

## 5. プロジェクト構成

### 5.1 最終的なディレクトリ構造
```
factrail/
├── apps/
│   ├── api/                 # NestJS Backend
│   │   ├── src/
│   │   │   ├── facts/       
│   │   │   ├── integrations/
│   │   │   ├── collectors/  
│   │   │   │   ├── github/
│   │   │   │   └── slack/
│   │   │   ├── dispatchers/ 
│   │   │   ├── common/      
│   │   │   │   ├── crypto/
│   │   │   │   ├── prisma/
│   │   │   │   └── supabase/
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── .env
│   │   └── package.json
│   │
│   └── web/                 # Next.js Frontend
│       ├── app/
│       ├── .env.local
│       └── package.json
│
├── package.json            
└── README.md
```

---

## 6. Supabase連携サービス

### 6.1 src/common/supabase/supabase.service.ts
```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get('SUPABASE_URL'),
      this.configService.get('SUPABASE_SERVICE_KEY'),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  // F2A Events を直接参照する場合
  async getUnimportedF2AEvents(since: Date) {
    const { data, error } = await this.supabase
      .from('events')
      .select('*')
      .gte('created_at', since.toISOString())
      .is('external_id', null);

    if (error) throw error;
    return data;
  }

  // Factrail Facts の Supabase 経由アクセス
  async getFactsViaSupabase(limit = 50) {
    const { data, error } = await this.supabase
      .schema('factrail')
      .from('facts')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }
}
```

---

## 7. Railway デプロイ設定

### 7.1 railway.json (API)
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd apps/api && npm ci && npx prisma generate && npm run build"
  },
  "deploy": {
    "startCommand": "cd apps/api && npm run start:prod",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 7.2 環境変数（Railway）

Railway ダッシュボードで設定：
```
# Supabase
DATABASE_URL=<Supabase Direct Connection String>
SUPABASE_URL=<Supabase Project URL>
SUPABASE_SERVICE_KEY=<Service Role Key>

# Security
ENCRYPTION_KEY=<32文字のランダム文字列>

# Slack
SLACK_CLIENT_ID=<Slack App Client ID>
SLACK_CLIENT_SECRET=<Slack App Client Secret>

# GitHub
GITHUB_WEBHOOK_SECRET=<GitHub Webhook Secret>

# Redis (Railway Redisを追加した場合)
REDIS_URL=<Railway Redis URL>
```

---

## 8. 開発開始

### 8.1 ローカル起動
```bash
# Redisをローカルで起動（Dockerを使用）
docker run -d -p 6379:6379 redis:alpine

# 開発サーバー起動
npm run dev
```

### 8.2 データベース確認
```bash
# Prisma Studioで確認
cd apps/api
npx prisma studio

# Supabase Dashboardでも確認可能
# Table Editor → factrailスキーマを選択
```

### 8.3 アクセス URL

- API: http://localhost:3001
- API Docs: http://localhost:3001/api
- Web: http://localhost:3000
- Prisma Studio: http://localhost:5555
- Supabase Dashboard: https://app.supabase.com

---

## 9. F2Aとの連携確認

### 9.1 F2A側でFactrailデータを確認
```sql
-- F2A側のSupabase SQL Editor
SELECT * FROM factrail.facts ORDER BY occurred_at DESC LIMIT 10;

-- または事前作成したビューを使用
SELECT * FROM public.factrail_pending_facts LIMIT 10;
```

### 9.2 F2A側のPrismaスキーマ追加（オプション）
```prisma
// F2A側のschema.prismaに追加
model FactrailFact {
  id          String   @id
  title       String
  source      String
  metadata    Json?
  occurredAt  DateTime @map("occurred_at")
  
  @@map("factrail_pending_facts")
  @@schema("public")
}
```

---

## 次のステップ

1. NestJS の各モジュール実装
2. 暗号化サービスの実装
3. GitHub Webhook コントローラー作成
4. Slack OAuth フロー実装
5. F2A連携APIの実装