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
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    it('設定を作成または更新できること', async () => {
      mockPrismaService.settings.upsert.mockResolvedValue(mockSetting);

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
      expect(prisma.settings.upsert).toHaveBeenCalledWith({
        where: {
          provider_settingType: {
            provider: 'github',
            settingType: 'webhook_secret',
          },
        },
        create: {
          provider: 'github',
          settingType: 'webhook_secret',
          value: 'encrypted-my-secret-value',
        },
        update: {
          value: 'encrypted-my-secret-value',
        },
      });
    });

    it('値が空の設定も保存できること', async () => {
      const emptyDto = { ...createDto, value: '' };
      const emptySettings = {
        ...mockSetting,
        value: 'encrypted-',
      };
      mockPrismaService.settings.upsert.mockResolvedValue(emptySettings);

      const result = await service.upsert(emptyDto);

      expect(result.hasValue).toBe(true);
      expect(crypto.encrypt).toHaveBeenCalledWith('');
    });
  });

  describe('findAll', () => {
    const mockSettings = [
      {
        id: 'setting-1',
        provider: 'github',
        settingType: 'webhook_secret',
        value: 'encrypted-value-1',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'setting-2',
        provider: 'slack',
        settingType: 'client_id',
        value: 'encrypted-value-2',
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
      expect(result[1]).toEqual({
        id: 'setting-2',
        provider: 'slack',
        settingType: 'client_id',
        hasValue: true,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
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

    it('設定がない場合は空配列を返すこと', async () => {
      mockPrismaService.settings.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('値がnullの設定はhasValueがfalseであること', async () => {
      const settingWithNullValue = [
        {
          ...mockSettings[0],
          value: null,
        },
      ];
      mockPrismaService.settings.findMany.mockResolvedValue(settingWithNullValue);

      const result = await service.findAll();

      expect(result[0].hasValue).toBe(false);
    });
  });

  describe('findOne', () => {
    const mockSetting = {
      id: 'setting-1',
      provider: 'github',
      settingType: 'webhook_secret',
      value: 'encrypted-value',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    it('特定の設定を取得できること', async () => {
      mockPrismaService.settings.findUnique.mockResolvedValue(mockSetting);

      const result = await service.findOne('github', 'webhook_secret');

      expect(result).toEqual({
        id: 'setting-1',
        provider: 'github',
        settingType: 'webhook_secret',
        hasValue: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      });
      expect(prisma.settings.findUnique).toHaveBeenCalledWith({
        where: {
          provider_settingType: {
            provider: 'github',
            settingType: 'webhook_secret',
          },
        },
      });
    });

    it('設定が見つからない場合はNotFoundExceptionをスローすること', async () => {
      mockPrismaService.settings.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('github', 'webhook_secret'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findOne('github', 'webhook_secret'),
      ).rejects.toThrow('設定が見つかりません: github/webhook_secret');
    });
  });

  describe('getDecryptedValue', () => {
    const mockSetting = {
      id: 'setting-1',
      provider: 'github',
      settingType: 'webhook_secret',
      value: 'encrypted-my-secret',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    it('復号化された値を取得できること', async () => {
      mockPrismaService.settings.findUnique.mockResolvedValue(mockSetting);

      const result = await service.getDecryptedValue('github', 'webhook_secret');

      expect(result).toBe('my-secret');
      expect(crypto.decrypt).toHaveBeenCalledWith('encrypted-my-secret');
    });

    it('設定が見つからない場合はnullを返すこと', async () => {
      mockPrismaService.settings.findUnique.mockResolvedValue(null);

      const result = await service.getDecryptedValue('github', 'webhook_secret');

      expect(result).toBeNull();
      expect(crypto.decrypt).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    const mockSetting = {
      id: 'setting-1',
      provider: 'github',
      settingType: 'webhook_secret',
      value: 'encrypted-value',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    it('設定を削除できること', async () => {
      mockPrismaService.settings.findUnique.mockResolvedValue(mockSetting);
      mockPrismaService.settings.delete.mockResolvedValue(mockSetting);

      await service.remove('github', 'webhook_secret');

      expect(prisma.settings.delete).toHaveBeenCalledWith({
        where: {
          provider_settingType: {
            provider: 'github',
            settingType: 'webhook_secret',
          },
        },
      });
    });

    it('設定が見つからない場合はNotFoundExceptionをスローすること', async () => {
      mockPrismaService.settings.findUnique.mockResolvedValue(null);

      await expect(
        service.remove('github', 'webhook_secret'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.remove('github', 'webhook_secret'),
      ).rejects.toThrow('設定が見つかりません: github/webhook_secret');
      expect(prisma.settings.delete).not.toHaveBeenCalled();
    });
  });
});
