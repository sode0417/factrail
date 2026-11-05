import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma.service';
import { CronHealthService, CronJobStatus } from './cron-health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: PrismaService;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  const mockCronHealth = {
    getStatuses: jest.fn(),
  };

  const cron = (status: CronJobStatus['status']): CronJobStatus => ({
    status,
    lastSuccessAt: null,
    lastFailureAt: null,
    consecutiveFailures: 0,
    staleAfterMinutes: 60,
  });

  beforeEach(async () => {
    mockCronHealth.getStatuses.mockReturnValue({});

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CronHealthService,
          useValue: mockCronHealth,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('check', () => {
    it('データベースが正常な場合はokステータスを返すこと', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.check();

      expect(result.status).toBe('ok');
      expect(result.services.database).toBe('healthy');
      expect(result.timestamp).toBeDefined();
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('データベースが異常な場合はunhealthyステータスを返すこと', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Database connection failed'));

      const result = await controller.check();

      expect(result.status).toBe('unhealthy');
      expect(result.services.database).toBe('unhealthy');
      expect(result.timestamp).toBeDefined();
    });

    it('cronが1本でもstaleならdegradedステータスを返すこと', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockCronHealth.getStatuses.mockReturnValue({
        'browser-collector': cron('stale'),
        'scheduled-backup': cron('healthy'),
      });

      const result = await controller.check();

      expect(result.status).toBe('degraded');
      expect(result.crons['browser-collector'].status).toBe('stale');
    });

    it('cronがpending・disabledだけならokステータスを返すこと', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockCronHealth.getStatuses.mockReturnValue({
        'browser-collector': cron('disabled'),
        'slack-collector': cron('pending'),
        'scheduled-backup': cron('healthy'),
      });

      const result = await controller.check();

      expect(result.status).toBe('ok');
    });

    it('データベース異常とcronのstaleが重なった場合はunhealthyを優先すること', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Database connection failed'));
      mockCronHealth.getStatuses.mockReturnValue({ 'scheduled-backup': cron('stale') });

      const result = await controller.check();

      expect(result.status).toBe('unhealthy');
    });

    it('タイムスタンプがISO形式であること', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.check();

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('servicesオブジェクトにdatabaseが含まれること', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.check();

      expect(result.services).toHaveProperty('database');
    });
  });
});
