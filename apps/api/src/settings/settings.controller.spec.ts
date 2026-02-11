import { Test, TestingModule } from '@nestjs/testing';
import { SettingsController } from './settings.controller';
import { SettingsService, SettingResponse } from './settings.service';
import { CreateSettingDto } from './dto';

describe('SettingsController', () => {
  let controller: SettingsController;
  let service: SettingsService;

  const mockSettingsService = {
    upsert: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  const mockSettingResponse: SettingResponse = {
    id: 'setting-1',
    provider: 'github',
    settingType: 'webhook_secret',
    hasValue: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockRequest = {
    user: { id: 'user-1' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        {
          provide: SettingsService,
          useValue: mockSettingsService,
        },
      ],
    }).compile();

    controller = module.get<SettingsController>(SettingsController);
    service = module.get<SettingsService>(SettingsService);
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

    it('設定を作成または更新できること', async () => {
      mockSettingsService.upsert.mockResolvedValue(mockSettingResponse);

      const result = await controller.upsert(mockRequest, createDto);

      expect(result).toEqual(mockSettingResponse);
      expect(service.upsert).toHaveBeenCalledWith(createDto);
    });

    it('レスポンスに値が含まれないこと', async () => {
      mockSettingsService.upsert.mockResolvedValue(mockSettingResponse);

      const result = await controller.upsert(mockRequest, createDto);

      expect(result).not.toHaveProperty('value');
      expect(result.hasValue).toBe(true);
    });
  });

  describe('findAll', () => {
    const mockSettings: SettingResponse[] = [
      {
        id: 'setting-1',
        provider: 'github',
        settingType: 'webhook_secret',
        hasValue: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'setting-2',
        provider: 'slack',
        settingType: 'client_id',
        hasValue: true,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
      },
    ];

    it('全ての設定を取得できること（ユーザーIDを渡す）', async () => {
      mockSettingsService.findAll.mockResolvedValue(mockSettings);

      const result = await controller.findAll(mockRequest);

      expect(result).toEqual(mockSettings);
      expect(service.findAll).toHaveBeenCalledWith(undefined, 'user-1');
    });

    it('プロバイダーでフィルタリングできること', async () => {
      const githubSettings = [mockSettings[0]];
      mockSettingsService.findAll.mockResolvedValue(githubSettings);

      const result = await controller.findAll(mockRequest, 'github');

      expect(result).toEqual(githubSettings);
      expect(service.findAll).toHaveBeenCalledWith('github', 'user-1');
    });

    it('空の配列を返すこと', async () => {
      mockSettingsService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(mockRequest);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('特定の設定を取得できること', async () => {
      mockSettingsService.findOne.mockResolvedValue(mockSettingResponse);

      const result = await controller.findOne('github', 'webhook_secret');

      expect(result).toEqual(mockSettingResponse);
      expect(service.findOne).toHaveBeenCalledWith('github', 'webhook_secret');
    });

    it('異なるプロバイダーとタイプで取得できること', async () => {
      const slackSetting: SettingResponse = {
        id: 'setting-2',
        provider: 'slack',
        settingType: 'client_id',
        hasValue: true,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
      };
      mockSettingsService.findOne.mockResolvedValue(slackSetting);

      const result = await controller.findOne('slack', 'client_id');

      expect(result).toEqual(slackSetting);
      expect(service.findOne).toHaveBeenCalledWith('slack', 'client_id');
    });
  });

  describe('remove', () => {
    it('設定を削除できること', async () => {
      mockSettingsService.remove.mockResolvedValue(undefined);

      await controller.remove('github', 'webhook_secret');

      expect(service.remove).toHaveBeenCalledWith('github', 'webhook_secret');
    });

    it('削除時に値を返さないこと', async () => {
      mockSettingsService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('github', 'webhook_secret');

      expect(result).toBeUndefined();
    });
  });
});
