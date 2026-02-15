import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma.service';
import { CryptoService } from '../common/crypto';
import { CreateSettingDto } from './dto';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: PrismaService;
  let crypto: CryptoService;

  const mockPrismaService = {
    settings: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockCryptoService = {
    encrypt: jest.fn((value: string) => `encrypted-${value}`),
    decrypt: jest.fn((value: string) => value.replace('encrypted-', '')),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CryptoService,
          useValue: mockCryptoService,
        },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    prisma = module.get<PrismaService>(PrismaService);
    crypto = module.get<CryptoService>(CryptoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('upsert', () => {
    const createDto: CreateSettingDto = {
      provider: 'github',
      settingType: 'webhook_secret',
      value: 'my-secret-value',
    };

    const mockSetting = {
      id: 'setting-1',
      provider: 'github',
      settingType: 'webhook_secret',
      value: 'encrypted-my-secret-value',
      userId: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    it('グローバル設定を新規作成できること（既存なし）', async () => {
      mockPrismaService.settings.findFirst.mockResolvedValue(null);
      mockPrismaService.settings.create.mockResolvedValue(mockSetting);

      const result = await service.upsert(createDto);

      expect(result).toEqual({
        id: 'setting-1',
        provider: 'github',
        settingType: 'webhook_secret',
        hasValue: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      });
      expect(crypto.encrypt).toHaveBeenCalledWith('my-secret-value');
      expect(prisma.settings.findFirst).toHaveBeenCalledWith({
        where: {
          userId: null,
          provider: 'github',
          settingType: 'webhook_secret',
        },
      });
      expect(prisma.settings.create).toHaveBeenCalledWith({
        data: {
          provider: 'github',
          settingType: 'webhook_secret',
          value: 'encrypted-my-secret-value',
          userId: null,
        },
      });
    });

    it('グローバル設定を更新できること（既存あり）', async () => {
      mockPrismaService.settings.findFirst.mockResolvedValue(mockSetting);
      mockPrismaService.settings.update.mockResolvedValue(mockSetting);

      await service.upsert(createDto);

      expect(prisma.settings.update).toHaveBeenCalledWith({
        where: { id: 'setting-1' },
        data: { value: 'encrypted-my-secret-value' },
      });
    });

    it('ユーザー別設定を作成または更新できること', async () => {
      const userSetting = { ...mockSetting, userId: 'user-1' };
      mockPrismaService.settings.upsert.mockResolvedValue(userSetting);

      await service.upsert(createDto, 'user-1');

      expect(prisma.settings.upsert).toHaveBeenCalledWith({
        where: {
          userId_provider_settingType: {
            userId: 'user-1',
            provider: 'github',
            settingType: 'webhook_secret',
          },
        },
        create: {
          provider: 'github',
          settingType: 'webhook_secret',
          value: 'encrypted-my-secret-value',
          userId: 'user-1',
        },
        update: {
          value: 'encrypted-my-secret-value',
        },
      });
    });
  });

  describe('findAll', () => {
    const mockSettings = [
      {
        id: 'setting-1',
        provider: 'github',
        settingType: 'webhook_secret',
        value: 'encrypted-value-1',
        userId: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'setting-2',
        provider: 'slack',
        settingType: 'client_id',
        value: 'encrypted-value-2',
        userId: null,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
      },
    ];

    it('全ての設定を取得できること', async () => {
      mockPrismaService.settings.findMany.mockResolvedValue(mockSettings);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'setting-1',
        provider: 'github',
        settingType: 'webhook_secret',
        hasValue: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      });
      expect(prisma.settings.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: [{ provider: 'asc' }, { settingType: 'asc' }],
      });
    });

    it('プロバイダーで設定をフィルタリングできること', async () => {
      const githubSettings = [mockSettings[0]];
      mockPrismaService.settings.findMany.mockResolvedValue(githubSettings);

      const result = await service.findAll('github');

      expect(result).toHaveLength(1);
      expect(result[0].provider).toBe('github');
      expect(prisma.settings.findMany).toHaveBeenCalledWith({
        where: { provider: 'github' },
        orderBy: [{ provider: 'asc' }, { settingType: 'asc' }],
      });
    });

    it('userId指定時はそのユーザーの設定のみ返すこと', async () => {
      mockPrismaService.settings.findMany.mockResolvedValue(mockSettings);

      await service.findAll(undefined, 'user-1');

      expect(prisma.settings.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: [{ provider: 'asc' }, { settingType: 'asc' }],
      });
    });

    it('provider+userId指定時は両方のフィルタが適用されること', async () => {
      mockPrismaService.settings.findMany.mockResolvedValue([]);

      await service.findAll('slack', 'user-1');

      expect(prisma.settings.findMany).toHaveBeenCalledWith({
        where: {
          provider: 'slack',
          userId: 'user-1',
        },
        orderBy: [{ provider: 'asc' }, { settingType: 'asc' }],
      });
    });

    it('設定がない場合は空配列を返すこと', async () => {
      mockPrismaService.settings.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    const mockSetting = {
      id: 'setting-1',
      provider: 'github',
      settingType: 'webhook_secret',
      value: 'encrypted-value',
      userId: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    it('グローバル設定を取得できること（userId未指定）', async () => {
      mockPrismaService.settings.findFirst.mockResolvedValue(mockSetting);

      const result = await service.findOne('github', 'webhook_secret');

      expect(result).toEqual({
        id: 'setting-1',
        provider: 'github',
        settingType: 'webhook_secret',
        hasValue: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      });
      expect(prisma.settings.findFirst).toHaveBeenCalledWith({
        where: {
          userId: null,
          provider: 'github',
          settingType: 'webhook_secret',
        },
      });
    });

    it('ユーザー別設定を取得できること（userId指定）', async () => {
      const userSetting = { ...mockSetting, userId: 'user-1' };
      mockPrismaService.settings.findUnique.mockResolvedValue(userSetting);

      const result = await service.findOne('github', 'webhook_secret', 'user-1');

      expect(result.id).toBe('setting-1');
      expect(prisma.settings.findUnique).toHaveBeenCalledWith({
        where: {
          userId_provider_settingType: {
            userId: 'user-1',
            provider: 'github',
            settingType: 'webhook_secret',
          },
        },
      });
    });

    it('設定が見つからない場合はNotFoundExceptionをスローすること', async () => {
      mockPrismaService.settings.findFirst.mockResolvedValue(null);

      await expect(service.findOne('github', 'webhook_secret')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('github', 'webhook_secret')).rejects.toThrow(
        '設定が見つかりません: github/webhook_secret',
      );
    });
  });

  describe('getDecryptedValue', () => {
    const mockSetting = {
      id: 'setting-1',
      provider: 'github',
      settingType: 'webhook_secret',
      value: 'encrypted-my-secret',
      userId: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    it('グローバル設定の復号化された値を取得できること', async () => {
      mockPrismaService.settings.findFirst.mockResolvedValue(mockSetting);

      const result = await service.getDecryptedValue('github', 'webhook_secret');

      expect(result).toBe('my-secret');
      expect(crypto.decrypt).toHaveBeenCalledWith('encrypted-my-secret');
    });

    it('グローバル設定がなくてもユーザー別設定にフォールバックすること', async () => {
      const userSetting = { ...mockSetting, userId: 'user-1' };
      mockPrismaService.settings.findFirst
        .mockResolvedValueOnce(null) // グローバル設定なし
        .mockResolvedValueOnce(userSetting); // ユーザー別設定あり

      const result = await service.getDecryptedValue('github', 'webhook_secret');

      expect(result).toBe('my-secret');
      expect(prisma.settings.findFirst).toHaveBeenCalledTimes(2);
      // 2回目: ユーザーを問わず検索
      expect(prisma.settings.findFirst).toHaveBeenNthCalledWith(2, {
        where: {
          provider: 'github',
          settingType: 'webhook_secret',
        },
      });
    });

    it('全ての設定が見つからない場合はnullを返すこと', async () => {
      mockPrismaService.settings.findFirst.mockResolvedValue(null);

      const result = await service.getDecryptedValue('github', 'webhook_secret');

      expect(result).toBeNull();
      expect(crypto.decrypt).not.toHaveBeenCalled();
    });

    it('userId指定時にユーザー別設定を優先して返すこと', async () => {
      const userSetting = { ...mockSetting, userId: 'user-1', value: 'encrypted-user-secret' };
      mockPrismaService.settings.findUnique.mockResolvedValue(userSetting);

      const result = await service.getDecryptedValue('slack', 'target_channel_id', 'user-1');

      expect(result).toBe('user-secret');
      expect(prisma.settings.findUnique).toHaveBeenCalledWith({
        where: {
          userId_provider_settingType: {
            userId: 'user-1',
            provider: 'slack',
            settingType: 'target_channel_id',
          },
        },
      });
    });

    it('userId指定時にユーザー別設定がなければグローバル設定にフォールバックすること', async () => {
      mockPrismaService.settings.findUnique.mockResolvedValue(null); // ユーザー別設定なし
      mockPrismaService.settings.findFirst.mockResolvedValue(mockSetting); // グローバル設定あり

      const result = await service.getDecryptedValue('slack', 'target_channel_id', 'user-1');

      expect(result).toBe('my-secret');
      // ユーザー別設定の検索（findUnique）
      expect(prisma.settings.findUnique).toHaveBeenCalledWith({
        where: {
          userId_provider_settingType: {
            userId: 'user-1',
            provider: 'slack',
            settingType: 'target_channel_id',
          },
        },
      });
      // グローバル設定の検索（findFirst）
      expect(prisma.settings.findFirst).toHaveBeenCalledWith({
        where: {
          userId: null,
          provider: 'slack',
          settingType: 'target_channel_id',
        },
      });
    });
  });

  describe('remove', () => {
    const mockSetting = {
      id: 'setting-1',
      provider: 'github',
      settingType: 'webhook_secret',
      value: 'encrypted-value',
      userId: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    it('グローバル設定を削除できること', async () => {
      mockPrismaService.settings.findFirst.mockResolvedValue(mockSetting);
      mockPrismaService.settings.delete.mockResolvedValue(mockSetting);

      await service.remove('github', 'webhook_secret');

      expect(prisma.settings.findFirst).toHaveBeenCalledWith({
        where: {
          userId: null,
          provider: 'github',
          settingType: 'webhook_secret',
        },
      });
      expect(prisma.settings.delete).toHaveBeenCalledWith({
        where: { id: 'setting-1' },
      });
    });

    it('ユーザー別設定を削除できること', async () => {
      const userSetting = { ...mockSetting, userId: 'user-1' };
      mockPrismaService.settings.findUnique.mockResolvedValue(userSetting);
      mockPrismaService.settings.delete.mockResolvedValue(userSetting);

      await service.remove('github', 'webhook_secret', 'user-1');

      expect(prisma.settings.findUnique).toHaveBeenCalledWith({
        where: {
          userId_provider_settingType: {
            userId: 'user-1',
            provider: 'github',
            settingType: 'webhook_secret',
          },
        },
      });
      expect(prisma.settings.delete).toHaveBeenCalledWith({
        where: { id: 'setting-1' },
      });
    });

    it('設定が見つからない場合はNotFoundExceptionをスローすること', async () => {
      mockPrismaService.settings.findFirst.mockResolvedValue(null);

      await expect(service.remove('github', 'webhook_secret')).rejects.toThrow(NotFoundException);
      await expect(service.remove('github', 'webhook_secret')).rejects.toThrow(
        '設定が見つかりません: github/webhook_secret',
      );
      expect(prisma.settings.delete).not.toHaveBeenCalled();
    });
  });
});
