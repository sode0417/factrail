import { Test, TestingModule } from '@nestjs/testing';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';

describe('BackupController', () => {
  let controller: BackupController;

  const mockBackupService = {
    createUserBackup: jest.fn(),
  };

  const mockRequest = { user: { id: 'user-123' } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BackupController],
      providers: [
        { provide: BackupService, useValue: mockBackupService },
      ],
    }).compile();

    controller = module.get<BackupController>(BackupController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('trigger', () => {
    it('バックアップデータを JSON として返すこと', async () => {
      const mockBackup = {
        metadata: { version: '1.0', createdAt: '2024-01-01', userId: 'user-123' },
        facts: [],
        integrations: [],
        repositories: [],
      };
      mockBackupService.createUserBackup.mockResolvedValue(mockBackup);

      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      await controller.trigger(mockRequest, mockRes as any);

      expect(mockBackupService.createUserBackup).toHaveBeenCalledWith('user-123');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename="factrail-backup-'),
      );
      expect(mockRes.send).toHaveBeenCalled();
    });
  });
});
