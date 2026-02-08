import { Test, TestingModule } from '@nestjs/testing';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import * as request from 'supertest';
import helmet from 'helmet';

/**
 * セキュリティ検証用の軽量コントローラー
 * DB接続不要でセキュリティミドルウェアの動作を検証する
 */
@Controller('security-test')
class SecurityTestController {
  @Get()
  getTest() {
    return { ok: true };
  }
}

/**
 * セキュリティ機能 E2Eテスト
 * 実際のHTTPレスポンスでセキュリティ設定が有効になっていることを検証する
 */
describe('Security (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // AppModuleと同じレート制限設定
        ThrottlerModule.forRoot([
          {
            name: 'short',
            ttl: 1000,
            limit: 3,
          },
          {
            name: 'medium',
            ttl: 10000,
            limit: 20,
          },
          {
            name: 'long',
            ttl: 60000,
            limit: 100,
          },
        ]),
      ],
      controllers: [SecurityTestController],
      providers: [
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    // main.tsと同じhelmet設定を適用
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
          },
        },
        crossOriginEmbedderPolicy: false,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Helmet セキュリティヘッダー', () => {
    it('X-Content-Type-Options: nosniff が設定されていること', async () => {
      const response = await request(app.getHttpServer()).get('/security-test');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('X-Frame-Options が設定されていること', async () => {
      const response = await request(app.getHttpServer()).get('/security-test');

      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    });

    it('Content-Security-Policy が設定されていること', async () => {
      const response = await request(app.getHttpServer()).get('/security-test');

      const csp = response.headers['content-security-policy'];
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
    });

    it('X-Powered-By ヘッダーが削除されていること', async () => {
      const response = await request(app.getHttpServer()).get('/security-test');

      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('Strict-Transport-Security が設定されていること', async () => {
      const response = await request(app.getHttpServer()).get('/security-test');

      expect(response.headers['strict-transport-security']).toBeDefined();
    });
  });

  describe('レート制限（ThrottlerGuard）', () => {
    // 前のテストでレート制限に達している可能性があるためリセットを待つ
    beforeAll(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    it('通常のリクエストは200を返すこと', async () => {
      await request(app.getHttpServer()).get('/security-test').expect(200);
    });

    it('短時間に大量リクエストを送ると429を返すこと', async () => {
      const server = app.getHttpServer();
      const results: number[] = [];

      // short制限: 1秒に3リクエストまで
      // 連続送信して429が返ることを確認
      for (let i = 0; i < 6; i++) {
        const res = await request(server).get('/security-test');
        results.push(res.status);
      }

      expect(results).toContain(429);
    });

    it('429レスポンスに適切なエラーメッセージが含まれること', async () => {
      const server = app.getHttpServer();

      // レート制限リセットを待つ
      await new Promise((resolve) => setTimeout(resolve, 1100));

      let rateLimitResponse;
      for (let i = 0; i < 10; i++) {
        const res = await request(server).get('/security-test');
        if (res.status === 429) {
          rateLimitResponse = res;
          break;
        }
      }

      expect(rateLimitResponse).toBeDefined();
      expect(rateLimitResponse.body.statusCode).toBe(429);
    });
  });
});
