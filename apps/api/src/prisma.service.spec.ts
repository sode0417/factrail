import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

// constructor が DATABASE_URL を必須にしているため（接続はしない）
process.env.DATABASE_URL ||= 'postgresql://localhost:5432/factrail_unit_test';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);

    // Mock the Prisma connection methods
    service.$connect = jest.fn().mockResolvedValue(undefined);
    service.$disconnect = jest.fn().mockResolvedValue(undefined);
    service.$queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]) as never;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('データベースに接続すること', async () => {
      await service.onModuleInit();

      expect(service.$connect).toHaveBeenCalled();
      expect(service.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('データベースから切断すること', async () => {
      await service.onModuleDestroy();

      expect(service.$disconnect).toHaveBeenCalled();
    });
  });
});
