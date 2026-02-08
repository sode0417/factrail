import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../prisma.service';
import { SessionService } from '../session/session.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: PrismaService;
  let sessionService: SessionService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'JWT_SECRET') return 'test-jwt-secret';
      return null;
    }),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockSessionService = {
    isBlacklisted: jest.fn(),
  };

  // モックリクエストオブジェクト
  const createMockRequest = (token?: string): Partial<Request> => ({
    headers: {
      authorization: token ? `Bearer ${token}` : undefined,
    },
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    prisma = module.get<PrismaService>(PrismaService);
    sessionService = module.get<SessionService>(SessionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    const payload = {
      sub: 'user-123',
      email: 'test@example.com',
    };

    const mockToken = 'valid-jwt-token';
    const mockRequest = createMockRequest(mockToken) as Request;

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      status: 'active',
      password: 'hashed-password',
      googleId: null,
      githubId: null,
      isEmailVerified: true,
      lastLoginAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockSessionService.isBlacklisted.mockResolvedValue(false);
    });

    it('有効なユーザーを返すこと', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await strategy.validate(mockRequest, payload);

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('ユーザーが見つからない場合はUnauthorizedExceptionをスローすること', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(strategy.validate(mockRequest, payload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(mockRequest, payload)).rejects.toThrow(
        'ユーザーが見つかりません',
      );
    });

    it('ユーザーステータスがactiveでない場合はUnauthorizedExceptionをスローすること', async () => {
      const inactiveUser = {
        ...mockUser,
        status: 'inactive',
      };
      mockPrismaService.user.findUnique.mockResolvedValue(inactiveUser);

      await expect(strategy.validate(mockRequest, payload)).rejects.toThrow(UnauthorizedException);
    });

    it('ユーザーステータスがsuspendedの場合はUnauthorizedExceptionをスローすること', async () => {
      const suspendedUser = {
        ...mockUser,
        status: 'suspended',
      };
      mockPrismaService.user.findUnique.mockResolvedValue(suspendedUser);

      await expect(strategy.validate(mockRequest, payload)).rejects.toThrow(UnauthorizedException);
    });

    it('ブラックリストに登録されたトークンの場合はUnauthorizedExceptionをスローすること', async () => {
      mockSessionService.isBlacklisted.mockResolvedValue(true);

      await expect(strategy.validate(mockRequest, payload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(mockRequest, payload)).rejects.toThrow(
        'トークンは無効化されています',
      );
    });

    it('トークンがブラックリストにない場合はブラックリストチェックを通過すること', async () => {
      mockSessionService.isBlacklisted.mockResolvedValue(false);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await strategy.validate(mockRequest, payload);

      expect(sessionService.isBlacklisted).toHaveBeenCalledWith(mockToken);
      expect(result).toEqual(mockUser);
    });
  });
});
