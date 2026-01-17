import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-encryption-key-at-least-32-chars'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptoService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<CryptoService>(CryptoService);
    service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('暗号化と復号化', () => {
    it('文字列を正しく暗号化・復号化できること', () => {
      const plaintext = 'my-secret-token-12345';

      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(encrypted).not.toBe(plaintext);
      expect(decrypted).toBe(plaintext);
    });

    it('同じ平文でも異なる暗号文が生成されること', () => {
      const plaintext = 'my-secret-token';

      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);

      // ランダムなsaltとIVにより、毎回異なる結果になる
      expect(encrypted1).not.toBe(encrypted2);

      // ただし、両方とも同じ平文に復号化される
      expect(service.decrypt(encrypted1)).toBe(plaintext);
      expect(service.decrypt(encrypted2)).toBe(plaintext);
    });

    it('空文字列を処理できること', () => {
      expect(service.encrypt('')).toBe('');
      expect(service.decrypt('')).toBe('');
    });

    it('null/undefinedを処理できること', () => {
      expect(service.encrypt(null as unknown as string)).toBeNull();
      expect(service.decrypt(null as unknown as string)).toBeNull();
      expect(service.encrypt(undefined as unknown as string)).toBeUndefined();
      expect(service.decrypt(undefined as unknown as string)).toBeUndefined();
    });

    it('Unicode文字を処理できること', () => {
      const plaintext = '日本語テスト🎉emoji';

      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('長い文字列を処理できること', () => {
      const plaintext = 'x'.repeat(10000);

      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('特殊文字を処理できること', () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~';

      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('不正なデータの復号化', () => {
    it('改ざんされた暗号文でエラーをスローすること', () => {
      const plaintext = 'my-secret-token';
      const encrypted = service.encrypt(plaintext);

      // 暗号化データを改ざん
      const tamperedBuffer = Buffer.from(encrypted, 'base64');
      tamperedBuffer[tamperedBuffer.length - 1] ^= 0xff;
      const tampered = tamperedBuffer.toString('base64');

      expect(() => service.decrypt(tampered)).toThrow('Failed to decrypt data');
    });

    it('無効なbase64でエラーをスローすること', () => {
      expect(() => service.decrypt('not-valid-base64!!!')).toThrow();
    });

    it('短すぎる暗号文でエラーをスローすること', () => {
      const shortData = Buffer.alloc(10).toString('base64');
      expect(() => service.decrypt(shortData)).toThrow();
    });
  });

  describe('isEncrypted', () => {
    it('暗号化データに対してtrueを返すこと', () => {
      const encrypted = service.encrypt('test');
      expect(service.isEncrypted(encrypted)).toBe(true);
    });

    it('平文に対してfalseを返すこと', () => {
      expect(service.isEncrypted('plaintext')).toBe(false);
    });

    it('空文字列に対してfalseを返すこと', () => {
      expect(service.isEncrypted('')).toBe(false);
    });

    it('null/undefinedに対してfalseを返すこと', () => {
      expect(service.isEncrypted(null as unknown as string)).toBe(false);
      expect(service.isEncrypted(undefined as unknown as string)).toBe(false);
    });
  });

  describe('初期化', () => {
    it('ENCRYPTION_KEYが未設定の場合エラーをスローすること', async () => {
      const configWithNoKey = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CryptoService,
          {
            provide: ConfigService,
            useValue: configWithNoKey,
          },
        ],
      }).compile();

      const serviceWithNoKey = module.get<CryptoService>(CryptoService);

      expect(() => serviceWithNoKey.onModuleInit()).toThrow(
        'ENCRYPTION_KEY environment variable is required',
      );
    });

    it('ENCRYPTION_KEYが短すぎる場合エラーをスローすること', async () => {
      const configWithShortKey = {
        get: jest.fn().mockReturnValue('short-key'),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CryptoService,
          {
            provide: ConfigService,
            useValue: configWithShortKey,
          },
        ],
      }).compile();

      const serviceWithShortKey = module.get<CryptoService>(CryptoService);

      expect(() => serviceWithShortKey.onModuleInit()).toThrow(
        'ENCRYPTION_KEY must be at least 32 characters',
      );
    });
  });
});
