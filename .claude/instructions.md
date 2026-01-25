# Factrail 開発ガイドライン

このドキュメントは、ClaudeがFactrailプロジェクトで開発を行う際に従うべきルールと方針を定義しています。

---

## 🌏 言語方針

**Factrailプロジェクトは日本語を優先します。**

### 日本語で記述するもの

1. **コミットメッセージ**: 件名・本文ともに日本語
2. **コード内のコメント**: すべて日本語（JSDoc、インラインコメント、TODO等）
3. **ログメッセージ**: すべて日本語
4. **エラーメッセージ**: ユーザー向けメッセージは日本語
5. **テスト**: `describe`と`it`の説明は日本語
6. **ドキュメント**: README、設計書等は日本語

### 英語を使用するもの

1. **コード**: 変数名、関数名、クラス名等は英語（ユビキタス言語に従う）
2. **エラーコード**: `VALIDATION_ERROR`等の定数は英語

### 理由

- チームメンバー全員が日本語話者
- ドメイン用語（ユビキタス言語）との整合性を保つ
- 仕様として読みやすくする

---

## コーディング規約

### TypeScript

- **厳格な型付け**: `any`型の使用は最小限に（既存のESLintルールに従う）
- **命名規則**:
  - クラス: `PascalCase` (例: `FactsService`)
  - 関数/変数: `camelCase` (例: `createFact`)
  - 定数: `UPPER_SNAKE_CASE` (例: `DEFAULT_PAGE_SIZE`)
  - インターフェース: `PascalCase` (例: `CreateFactDto`)
- **未使用変数**: `_`プレフィックスを使用（例: `_unusedParam`）

### コメント

**重要**: コード内のコメントは**日本語**で記述すること。

```typescript
// ✅ 良い例（日本語コメント）
export class FactsService {
  /**
   * 外部イベントから記録を作成する
   * @param dto 記録作成用のDTO
   * @returns 作成された記録
   */
  async createFact(dto: CreateFactDto): Promise<Fact> {
    // 重複チェック: 同じソース + 外部IDの記録が既に存在する場合はエラー
    const existing = await this.prisma.fact.findUnique({
      where: {
        source_externalId: {
          source: dto.source,
          externalId: dto.externalId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('この記録は既に存在します');
    }

    // 記録を作成
    return this.prisma.fact.create({ data: dto });
  }
}

// ❌ 悪い例（英語コメント）
export class FactsService {
  /**
   * Create a fact from external event
   * @param dto DTO for creating fact
   * @returns Created fact
   */
  async createFact(dto: CreateFactDto): Promise<Fact> {
    // Check for duplicate: throw error if fact with same source + externalId exists
    const existing = await this.prisma.fact.findUnique({
      where: {
        source_externalId: {
          source: dto.source,
          externalId: dto.externalId,
        },
      },
    });
    // ...
  }
}
```

**コメントのガイドライン**:
- ビジネスロジックの意図を説明する
- 複雑なアルゴリズムの動作を明確にする
- 「なぜ」そのコードが必要かを説明する（「何を」しているかは明白な場合は不要）
- TODOコメントも日本語で記述: `// TODO: トークンリフレッシュ処理を実装`

### コードフォーマット

- **Prettier設定**に従う:
  - セミコロン: あり
  - シングルクォート: あり
  - トレイリングカンマ: all
  - 行幅: 100文字
- **コミット前**: 自動フォーマット実行

### ファイル構成

```
src/
├── [domain]/              # ドメインごとにディレクトリ
│   ├── dto/              # Data Transfer Objects
│   ├── [domain].controller.ts
│   ├── [domain].service.ts
│   ├── [domain].module.ts
│   └── [domain].spec.ts  # テストファイル
└── common/               # 共通ユーティリティ
    ├── crypto/
    ├── filters/
    └── decorators/
```

---

## Factrail固有のルール

### データモデル原則

#### Fact（記録）の扱い

1. **不変性（Immutability）**
   - 一度作成された記録は更新しない（Write Once, Read Many）
   - 修正が必要な場合は新しい記録を作成

2. **段階的詳細化**
   - 必須: `title`（短い要約）
   - オプション: `summary`（詳細要約）→ `content`（完全な内容）→ `raw`（元データ）
   - クライアントは必要なレベルの情報だけ取得可能

3. **ソーストレーサビリティ**
   - 必ず`source`と`sourceUrl`を記録
   - 元データは`raw`フィールドに完全保存

#### Integration（連携）の扱い

1. **セキュリティ**
   - トークンは**必ず暗号化**してDB保存
   - 暗号化: `EncryptionService.encrypt()`
   - 復号化: `EncryptionService.decrypt()`

2. **トークンリフレッシュ**
   - `expiresAt`をチェックし、期限切れ前に自動更新
   - リフレッシュ失敗時は`status`を`inactive`に変更

#### Settings（設定）の扱い

1. **機密情報管理**
   - Webhook SecretやAPI Keyは`Settings`テーブルで暗号化管理
   - 環境変数に直接保存しない

---

## エラーハンドリング

### 基本方針

1. **明確なエラーメッセージ**
   - ユーザーに何が問題で、どう対処すべきか伝える
   - 技術的詳細はログに記録

2. **適切なHTTPステータスコード**
   - `400`: バリデーションエラー
   - `404`: リソースが見つからない
   - `429`: Rate Limit超過
   - `500`: サーバー内部エラー

3. **統一されたエラーレスポンス**
```typescript
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "ユーザー向けメッセージ",
    "details": { /* 詳細情報 */ }
  }
}
```

### エラーハンドリング例

```typescript
// ✅ 良い例（日本語コメント、日本語エラーメッセージ）
async createFact(dto: CreateFactDto) {
  try {
    return await this.prisma.fact.create({ data: dto });
  } catch (error) {
    // Prismaの一意制約違反エラー
    if (error.code === 'P2002') {
      throw new ConflictException(
        `記録が既に存在します: ${dto.source}/${dto.externalId}`
      );
    }
    // その他のエラーはログに記録して内部エラーとして返す
    this.logger.error('記録の作成に失敗しました', error.stack);
    throw new InternalServerErrorException('記録の作成に失敗しました');
  }
}

// ❌ 悪い例（エラー処理なし）
async createFact(dto: CreateFactDto) {
  return await this.prisma.fact.create({ data: dto });
}
```

**エラーメッセージのガイドライン**:
- ユーザー向けメッセージは日本語で記述
- エラーコードは英語の定数（`VALIDATION_ERROR`等）を使用
- ログメッセージも日本語で記述

---

## テストの書き方

### テスト方針

1. **テストの種類**
   - ユニットテスト: サービスロジック
   - E2Eテスト: APIエンドポイント
   - 統合テスト: 外部サービス連携

2. **テストカバレッジ**
   - 重要なビジネスロジックは必ずテスト
   - 最低限のカバレッジ: 70%以上

### テストファイル命名

```
[name].spec.ts    # ユニットテスト
[name].e2e.ts     # E2Eテスト
```

### テスト記述の原則

**重要**: テストの`describe`と`it`は、ドメインに即した**日本語**で記述すること。

- **理由**: ビジネスロジックを明確にし、ドメイン用語との整合性を保つため
- **ユビキタス言語を使用**: 下記のマッピング表に従う

### テスト例

```typescript
describe('Facts（記録）サービス', () => {
  let service: FactsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [FactsService, PrismaService],
    }).compile();

    service = module.get<FactsService>(FactsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('記録の作成', () => {
    it('外部イベントから記録を正常に作成できる', async () => {
      const dto: CreateFactDto = {
        source: 'github',
        externalId: 'repo#123',
        title: 'Test Issue',
        type: 'issue.created',
        occurredAt: new Date(),
        raw: {},
      };

      const result = await service.createFact(dto);

      expect(result).toBeDefined();
      expect(result.title).toBe('Test Issue');
    });

    it('重複する記録の作成時にConflictExceptionをスローする', async () => {
      // 同じsource + externalIdで2回作成を試みる
      const dto: CreateFactDto = {
        source: 'github',
        externalId: 'repo#123',
        title: 'Duplicate',
        type: 'issue.created',
        occurredAt: new Date(),
        raw: {},
      };

      await service.createFact(dto);

      await expect(service.createFact(dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('不変性の原則に従い、作成後の記録は更新できない', async () => {
      // 記録の不変性をテスト
    });
  });

  describe('記録の検索', () => {
    it('発生日時の範囲で記録を絞り込める', async () => {
      // テスト実装
    });

    it('ソース（github, slack等）で記録をフィルタできる', async () => {
      // テスト実装
    });
  });
});
```

```typescript
describe('Integrations（連携）サービス', () => {
  let service: IntegrationsService;
  let encryptionService: EncryptionService;

  beforeEach(async () => {
    // セットアップ
  });

  describe('連携の作成', () => {
    it('OAuthトークンを暗号化して連携を作成できる', async () => {
      const dto: CreateIntegrationDto = {
        provider: 'slack',
        accountId: 'U12345',
        accessToken: 'xoxb-plain-token',
      };

      const result = await service.createIntegration(dto);

      // トークンが暗号化されていることを確認
      expect(result.accessToken).not.toBe('xoxb-plain-token');
      expect(result.accessToken).toContain(':'); // 暗号化フォーマット
    });
  });

  describe('トークンのリフレッシュ', () => {
    it('期限切れのトークンを自動でリフレッシュする', async () => {
      // テスト実装
    });
  });
});
```

---

## ユビキタス言語（Ubiquitous Language）

Factrailプロジェクトで使用するドメイン用語の日本語・英語マッピング表。
**コード・テスト・ドキュメント・会話すべてで統一して使用すること。**

### コアドメイン

| 日本語 | 英語 | 説明 | 使用例 |
|--------|------|------|--------|
| 記録 | Fact | 外部・内部で発生した観測可能な出来事 | `Fact`, `FactsService`, `createFact()` |
| 軌跡 | Trail | 記録が時系列に積み重なったログ | `FactTrail`, `getTrail()` |
| 連携 | Integration | 外部サービスとのOAuth接続 | `Integration`, `IntegrationsService` |
| 設定 | Settings | システム設定（暗号化された機密情報） | `Settings`, `SettingsService` |

### 記録（Fact）関連

| 日本語 | 英語 | 説明 | 使用例 |
|--------|------|------|--------|
| ソース | source | 記録の発生元（github, slack等） | `fact.source` |
| 外部ID | externalId | 外部サービス上のID | `fact.externalId` |
| 発生日時 | occurredAt | 記録が発生した日時 | `fact.occurredAt` |
| タイトル | title | 記録の短い要約 | `fact.title` |
| 要約 | summary | 記録の詳細要約 | `fact.summary` |
| 内容 | content | 記録の完全な内容 | `fact.content` |
| 生データ | raw | 外部サービスから受け取った元データ | `fact.raw` |
| タイプ | type | イベントのタイプ（issue.created等） | `fact.type` |
| メタデータ | metadata | 追加の構造化情報 | `fact.metadata` |
| 処理済み日時 | processedAt | Slack投稿等の処理完了日時 | `fact.processedAt` |

### 連携（Integration）関連

| 日本語 | 英語 | 説明 | 使用例 |
|--------|------|------|--------|
| プロバイダー | provider | 連携先サービス（github, slack, google） | `integration.provider` |
| アカウントID | accountId | 連携先のアカウント識別子 | `integration.accountId` |
| アクセストークン | accessToken | OAuth認証トークン（暗号化済み） | `integration.accessToken` |
| リフレッシュトークン | refreshToken | トークン更新用（暗号化済み） | `integration.refreshToken` |
| 有効期限 | expiresAt | トークンの有効期限 | `integration.expiresAt` |
| スコープ | scope | OAuth権限の範囲 | `integration.scope` |
| ステータス | status | 連携の状態（active, inactive） | `integration.status` |
| 最終同期日時 | lastSyncAt | 最後にデータ同期した日時 | `integration.lastSyncAt` |

### Webhook関連

| 日本語 | 英語 | 説明 | 使用例 |
|--------|------|------|--------|
| Webhook | Webhook | 外部サービスからのHTTP通知 | `WebhooksController` |
| 署名 | signature | Webhookの正当性を検証する署名 | `verifySignature()` |
| ペイロード | payload | Webhookで受け取るデータ | `webhookPayload` |
| 検証 | verification | 署名の正当性確認 | `verifyGithubSignature()` |

### 配信（Dispatcher）関連

| 日本語 | 英語 | 説明 | 使用例 |
|--------|------|------|--------|
| 配信 | dispatch | 記録を外部へ送信する | `dispatchToSlack()` |
| キュー | queue | 非同期処理のためのジョブキュー | `Bull Queue`, `addToQueue()` |
| ジョブ | job | キューに追加される処理単位 | `SlackPostJob` |

### F2A連携関連

| 日本語 | 英語 | 説明 | 使用例 |
|--------|------|------|--------|
| イベント | Event | F2A側のデータモデル | `Event`, `F2AEvent` |
| エクスポート | export | Facts → F2A Events形式への変換 | `exportToF2A()` |
| インポート済み | imported | F2Aに取り込み済みのフラグ | `fact.f2aEventId` |
| 外部参照ID | externalId | F2A側から見た記録のID | `event.external_id` |

### セキュリティ関連

| 日本語 | 英語 | 説明 | 使用例 |
|--------|------|------|--------|
| 暗号化 | encryption | データの暗号化 | `EncryptionService.encrypt()` |
| 復号化 | decryption | データの復号化 | `EncryptionService.decrypt()` |
| 暗号化キー | encryptionKey | 暗号化に使用する秘密鍵 | `ENCRYPTION_KEY` |
| レート制限 | rateLimit | API呼び出し頻度の制限 | `@Throttle()` |

### データベース関連

| 日本語 | 英語 | 説明 | 使用例 |
|--------|------|------|--------|
| スキーマ | schema | データベーススキーマ | `factrail schema` |
| マイグレーション | migration | スキーマ変更の履歴管理 | `prisma migrate` |
| トランザクション | transaction | データベーストランザクション | `prisma.$transaction()` |

### 使用例（テスト）

```typescript
describe('記録（Fact）の不変性', () => {
  it('作成済みの記録は更新できない', async () => {
    // Write Once, Read Many の原則をテスト
  });
});

describe('連携（Integration）のトークン管理', () => {
  it('アクセストークンが暗号化されて保存される', async () => {
    // 暗号化の確認
  });

  it('有効期限切れのトークンを自動でリフレッシュする', async () => {
    // リフレッシュロジックのテスト
  });
});

describe('Webhookの署名検証', () => {
  it('正しい署名のWebhookを受理する', async () => {
    // 署名検証成功ケース
  });

  it('不正な署名のWebhookを拒否する', async () => {
    // 署名検証失敗ケース
  });
});
```

---

## コミットメッセージ

### 重要: 日本語で記述すること

コミットメッセージは**日本語**で記述してください。
- 理由: チームメンバー全員が日本語話者であり、ドメイン用語との整合性を保つため

### フォーマット

```
<type>(<scope>): <日本語の件名>

<日本語の本文>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Type

- `feat`: 新機能
- `fix`: バグ修正
- `refactor`: リファクタリング
- `test`: テスト追加・修正
- `docs`: ドキュメント
- `chore`: ビルド・設定変更
- `perf`: パフォーマンス改善

### Scope

- `api`: API関連
- `web`: Web UI関連
- `facts`: Factsドメイン（記録）
- `integrations`: Integrationsドメイン（連携）
- `webhooks`: Webhooks関連
- `github`: GitHub連携
- `slack`: Slack連携
- `settings`: Settings（設定）

### 例

```
feat(facts): GET /api/facts にページネーション機能を追加

- カーソルベースのページネーションを実装
- limit パラメータのバリデーションを追加
- APIドキュメントを更新

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

```
fix(webhooks): GitHub Webhook の署名検証エラーを修正

GitHub からの Webhook が署名検証で失敗する問題を修正。
ペイロードの JSON 文字列化の方法を変更し、署名計算を正しく行うようにした。

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

```
refactor(integrations): トークン暗号化処理を共通化

- EncryptionService を作成
- Integration と Settings で暗号化ロジックを共通化
- テストを追加

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## APIエンドポイント設計

### REST原則

1. **リソースベース**: `/api/facts`, `/api/integrations`
2. **HTTPメソッド**:
   - `GET`: 取得
   - `POST`: 作成
   - `PUT/PATCH`: 更新（Factは不変のため基本使わない）
   - `DELETE`: 削除

3. **レスポンス形式**:
```typescript
// 一覧取得
{
  "data": [...],
  "meta": {
    "hasMore": true,
    "nextCursor": "..."
  }
}

// 単一リソース
{
  "data": {...}
}
```

### バリデーション

- **class-validator**を使用
- DTOクラスでバリデーションルール定義

```typescript
/**
 * 記録作成用のDTO
 */
export class CreateFactDto {
  @IsString()
  @IsNotEmpty()
  source: string; // ソース: github, slack等

  @IsString()
  @IsNotEmpty()
  externalId: string; // 外部サービスのID

  @IsString()
  @MaxLength(200)
  title: string; // タイトル: 最大200文字

  @IsDateString()
  occurredAt: string; // 発生日時: ISO 8601形式

  @IsObject()
  raw: any; // 生データ: 外部サービスの元データ
}
```

---

## セキュリティ

### 必須対策

1. **入力検証**: すべてのユーザー入力をバリデート
2. **暗号化**: トークン・機密情報は必ず暗号化
3. **Rate Limiting**: `@nestjs/throttler`を使用
4. **CORS**: 信頼できるオリジンのみ許可
5. **Webhook検証**: GitHub署名検証を必ず実行

### Webhook検証例

```typescript
@Post('/webhooks/github')
async handleGithubWebhook(
  @Headers('x-hub-signature-256') signature: string,
  @Body() payload: any,
) {
  // GitHub署名を検証（セキュリティ必須）
  const isValid = this.webhookService.verifyGithubSignature(
    signature,
    JSON.stringify(payload),
  );

  if (!isValid) {
    throw new UnauthorizedException('Webhookの署名が不正です');
  }

  // Webhookペイロードを処理して記録を作成
  const fact = await this.factsService.createFromGithubWebhook(payload);

  return { success: true, factId: fact.id };
}
```

---

## パフォーマンス

### データベース

1. **インデックス**: 頻繁に検索されるフィールドにインデックス作成済み
   - `occurred_at`, `type`, `source`, `f2a_event_id`

2. **ページネーション**: カーソルベースを使用（大規模データに対応）

3. **N+1問題**: Prismaの`include`を活用

### キューイング

- **Bull (Redis)**を使用
- 時間のかかる処理（Slack投稿等）は非同期化

---

## 環境変数管理

### 必須環境変数

```env
# Database
DATABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# Security
ENCRYPTION_KEY=  # 32文字

# Integrations
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
GITHUB_WEBHOOK_SECRET=

# Infrastructure
REDIS_URL=
```

### アクセス方法

```typescript
constructor(private configService: ConfigService) {}

const dbUrl = this.configService.get<string>('DATABASE_URL');
```

---

## ログ出力

### 重要: 日本語で記述すること

ログメッセージは**日本語**で記述してください。

### レベル

- `log`: 一般情報
- `warn`: 警告（処理は続行）
- `error`: エラー（スタックトレース付き）
- `debug`: デバッグ情報（開発時のみ）

### 例

```typescript
// ✅ 良い例（日本語ログ）
this.logger.log(`記録を作成しました: ${fact.id}`);
this.logger.warn(`トークンの有効期限が近づいています: ${integration.id}`);
this.logger.error('Slackへの投稿に失敗しました', error.stack);
this.logger.debug(`Webhook受信: source=${payload.source}, type=${payload.type}`);

// ❌ 悪い例（英語ログ）
this.logger.log(`Fact created: ${fact.id}`);
this.logger.warn(`Token expiring soon: ${integration.id}`);
this.logger.error('Failed to post to Slack', error.stack);
```

**ログのガイドライン**:
- 運用時に読みやすい日本語で記述
- 重要な値（ID等）は変数展開で含める
- エラーログには必ずスタックトレースを含める

---

## PR作成時の要件

1. **タイトル**: Issueと同じタイトル
2. **本文**: 以下を日本語で記載
   - 実装内容の説明
   - 動作確認エビデンス（テスト結果、スクリーンショット）
   - レビュアーの動作確認手順
   - 確認用チェックリスト
3. **テスト**: 関連するテストを追加・更新
4. **ドキュメント**: 必要に応じて更新

---

## 参考リンク

- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Factrail API仕様](../docs/factrail-API.md)
- [Factrail セットアップ手順](../docs/factrail-setup.md)
