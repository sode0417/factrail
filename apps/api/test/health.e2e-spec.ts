import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Health Check E2Eテスト（CI用スモークテスト）
 * システムの基本的な稼働状態を確認する
 */
describe('Health (E2E)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('ステータス200を返すこと', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200);

      // レスポンス形式の確認
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
    });

    it('statusフィールドに "ok" または "degraded" が含まれること', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200);

      expect(['ok', 'degraded']).toContain(response.body.status);
    });

    it('servicesオブジェクトにdatabaseの状態が含まれること', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200);

      expect(response.body.services).toHaveProperty('database');
      expect(['healthy', 'unhealthy']).toContain(response.body.services.database);
    });

    it('timestampがISO 8601形式であること', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200);

      const timestamp = response.body.timestamp;
      expect(timestamp).toBeDefined();
      // ISO 8601形式の日時文字列であることを確認
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });
  });
});
