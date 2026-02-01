import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: PrismaService;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
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

    it('データベースが異常な場合はdegradedステータスを返すこと', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Database connection failed'));

      const result = await controller.check();

      expect(result.status).toBe('degraded');
      expect(result.services.database).toBe('unhealthy');
      expect(result.timestamp).toBeDefined();
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
