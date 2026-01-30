import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

/**
 * Facts API E2Eテスト（CI用スモークテスト）
 * 記録（Fact）APIの基本的な動作を確認する
 */
describe('Facts API (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // バリデーションパイプを設定（本番環境と同じ設定）
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    // テストデータのクリーンアップ
    await prisma.fact.deleteMany({
      where: {
        source: 'e2e-test',
      },
    });
    await app.close();
  });

  describe('GET /api/facts', () => {
    it('ステータス200を返すこと', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/facts')
        .expect(200);

      // レスポンス形式の確認
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('metaオブジェクトにhasMoreとnextCursorが含まれること', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/facts')
        .expect(200);

      expect(response.body.meta).toHaveProperty('hasMore');
      expect(typeof response.body.meta.hasMore).toBe('boolean');
      // nextCursorはhasMoreがtrueの場合のみ存在する
      if (response.body.meta.hasMore) {
        expect(response.body.meta).toHaveProperty('nextCursor');
      }
    });

    it('クエリパラメータ（limit）が機能すること', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/facts?limit=10')
        .expect(200);

      // limitを超えないことを確認
      expect(response.body.data.length).toBeLessThanOrEqual(10);
    });

    it('不正なlimitパラメータで400エラーを返すこと', async () => {
      await request(app.getHttpServer())
        .get('/api/facts?limit=invalid')
        .expect(400);
    });
  });

  describe('POST /api/facts', () => {
    it('正しいデータで記録を作成できること（201 Created）', async () => {
      const createDto = {
        source: 'e2e-test',
        externalId: 'test-001',
        title: 'E2Eテスト用記録',
        type: 'test.created',
        occurredAt: new Date().toISOString(),
        raw: { test: true },
      };

      const response = await request(app.getHttpServer())
        .post('/api/facts')
        .send(createDto)
        .expect(201);

      // 作成された記録の確認
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(createDto.title);
      expect(response.body.source).toBe(createDto.source);
      expect(response.body.externalId).toBe(createDto.externalId);
    });

    it('必須フィールドが欠けている場合に400エラーを返すこと', async () => {
      const invalidDto = {
        source: 'e2e-test',
        // titleが欠けている
        type: 'test.created',
      };

      await request(app.getHttpServer())
        .post('/api/facts')
        .send(invalidDto)
        .expect(400);
    });

    it('不正なデータ型で400エラーを返すこと', async () => {
      const invalidDto = {
        source: 'e2e-test',
        externalId: 'test-002',
        title: 'テスト',
        type: 'test.created',
        occurredAt: 'invalid-date', // 不正な日時形式
        raw: {},
      };

      await request(app.getHttpServer())
        .post('/api/facts')
        .send(invalidDto)
        .expect(400);
    });
  });

  describe('GET /api/facts/:id', () => {
    let createdFactId: string;

    beforeEach(async () => {
      // テスト用の記録を作成
      const createDto = {
        source: 'e2e-test',
        externalId: 'test-get-by-id',
        title: 'ID取得テスト用',
        type: 'test.created',
        occurredAt: new Date().toISOString(),
        raw: {},
      };

      const response = await request(app.getHttpServer())
        .post('/api/facts')
        .send(createDto)
        .expect(201);

      createdFactId = response.body.id;
    });

    it('存在する記録を取得できること', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/facts/${createdFactId}`)
        .expect(200);

      expect(response.body.id).toBe(createdFactId);
      expect(response.body.title).toBe('ID取得テスト用');
    });

    it('存在しないIDで404エラーを返すこと', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .get(`/api/facts/${nonExistentId}`)
        .expect(404);
    });

    it('UUIDでないIDで400エラーを返すこと', async () => {
      await request(app.getHttpServer())
        .get('/api/facts/invalid-id')
        .expect(400);
    });
  });
});
