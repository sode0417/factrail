import { Test, TestingModule } from '@nestjs/testing';
import { BackupService } from './backup.service';
import { PrismaService } from '../prisma.service';

describe('BackupService', () => {
  let service: BackupService;

  const mockPrismaService = {
    fact: { findMany: jest.fn(), count: jest.fn() },
    integration: { findMany: jest.fn(), count: jest.fn() },
    repository: { findMany: jest.fn(), count: jest.fn() },
    user: { count: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<BackupService>(BackupService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createUserBackup', () => {
    it('ユーザーデータをエクスポートできること', async () => {
      const mockFacts = [{ id: 'fact-1', title: 'Test' }];
      const mockIntegrations = [{ id: 'int-1', provider: 'github' }];
      const mockRepositories = [{ id: 'repo-1', name: 'test-repo' }];

      mockPrismaService.fact.findMany.mockResolvedValue(mockFacts);
      mockPrismaService.integration.findMany.mockResolvedValue(mockIntegrations);
      mockPrismaService.repository.findMany.mockResolvedValue(mockRepositories);

      const result = await service.createUserBackup('user-123');

      expect(result.metadata.version).toBe('1.0');
      expect(result.metadata.userId).toBe('user-123');
      expect(result.metadata.createdAt).toBeDefined();
      expect(result.facts).toEqual(mockFacts);
      expect(result.integrations).toEqual(mockIntegrations);
      expect(result.repositories).toEqual(mockRepositories);
    });
  });

  describe('scheduledBackup', () => {
    it('スケジュールバックアップがログ出力すること', async () => {
      mockPrismaService.fact.count.mockResolvedValue(100);
      mockPrismaService.integration.count.mockResolvedValue(5);
      mockPrismaService.repository.count.mockResolvedValue(10);
      mockPrismaService.user.count.mockResolvedValue(1);

      await service.scheduledBackup();

      expect(mockPrismaService.fact.count).toHaveBeenCalled();
      expect(mockPrismaService.user.count).toHaveBeenCalled();
    });

    it('エラー時にログ出力すること', async () => {
      mockPrismaService.fact.count.mockRejectedValue(new Error('DB error'));

      await expect(service.scheduledBackup()).resolves.not.toThrow();
    });
  });
});
