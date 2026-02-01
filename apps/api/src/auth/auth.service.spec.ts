import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';
import { SessionService } from './session/session.service';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let sessionService: SessionService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockSessionService = {
    createSession: jest.fn(),
    findSessionByRefreshToken: jest.fn(),
    updateSession: jest.fn(),
    deleteSession: jest.fn(),
    deleteAllUserSessions: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashed-password',
    status: 'active',
    isEmailVerified: false,
    googleId: null,
    githubId: null,
    avatar: null,
    lastLoginAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    sessionService = module.get<SessionService>(SessionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'newuser@example.com',
      password: 'password123',
      name: 'New User',
    };

    it('新規ユーザーを登録できること', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue({
        ...mockUser,
        email: registerDto.email,
        name: registerDto.name,
      });

      const result = await service.register(registerDto);

      expect(result).toEqual({
        id: mockUser.id,
        email: registerDto.email,
        name: registerDto.name,
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: registerDto.email,
          name: registerDto.name,
          password: 'hashed-password',
          isEmailVerified: false,
        },
      });
    });

    it('既に登録されているメールアドレスの場合はConflictExceptionをスローすること', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      await expect(service.register(registerDto)).rejects.toThrow(
        'このメールアドレスは既に登録されています',
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('validateUser', () => {
    it('正しいメール/パスワードでユーザーを検証できること', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        lastLoginAt: new Date(),
      });

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toEqual(mockUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it('ユーザーが存在しない場合はUnauthorizedExceptionをスローすること', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.validateUser('notfound@example.com', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validateUser('notfound@example.com', 'password')).rejects.toThrow(
        'メールアドレスまたはパスワードが正しくありません',
      );
    });

    it('パスワードが設定されていない場合はUnauthorizedExceptionをスローすること', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        password: null,
      });

      await expect(service.validateUser('test@example.com', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('パスワードが正しくない場合はUnauthorizedExceptionをスローすること', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.validateUser('test@example.com', 'wrongpassword')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validateUser('test@example.com', 'wrongpassword')).rejects.toThrow(
        'メールアドレスまたはパスワードが正しくありません',
      );
    });

    it('アカウントが無効化されている場合はUnauthorizedExceptionをスローすること', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        status: 'suspended',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.validateUser('test@example.com', 'password123')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validateUser('test@example.com', 'password123')).rejects.toThrow(
        'アカウントが無効化されています',
      );
    });
  });

  describe('validateOAuthUser', () => {
    const googleDto = {
      provider: 'google' as const,
      providerId: 'google-123',
      email: 'oauth@example.com',
      name: 'OAuth User',
      avatar: 'https://example.com/avatar.jpg',
    };

    const githubDto = {
      provider: 'github' as const,
      providerId: 'github-456',
      email: 'github@example.com',
      name: 'GitHub User',
    };

    it('既存のGoogleユーザーを検証してログイン日時を更新すること', async () => {
      const existingUser = { ...mockUser, googleId: googleDto.providerId };
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...existingUser,
        lastLoginAt: new Date(),
      });

      const result = await service.validateOAuthUser(googleDto);

      expect(result).toBeDefined();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: existingUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it('既存のGitHubユーザーを検証してログイン日時を更新すること', async () => {
      const existingUser = { ...mockUser, githubId: githubDto.providerId };
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...existingUser,
        lastLoginAt: new Date(),
      });

      const result = await service.validateOAuthUser(githubDto);

      expect(result).toBeDefined();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: existingUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it('新規Googleユーザーでメールアドレスが既存の場合はOAuth連携を追加すること', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // googleId検索
        .mockResolvedValueOnce(mockUser); // email検索

      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        googleId: googleDto.providerId,
        isEmailVerified: true,
      });

      const result = await service.validateOAuthUser(googleDto);

      expect(result.googleId).toBe(googleDto.providerId);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          googleId: googleDto.providerId,
          isEmailVerified: true,
          lastLoginAt: expect.any(Date),
        },
      });
    });

    it('新規GitHubユーザーでメールアドレスが既存の場合はOAuth連携を追加すること', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // githubId検索
        .mockResolvedValueOnce(mockUser); // email検索

      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        githubId: githubDto.providerId,
        isEmailVerified: true,
      });

      const result = await service.validateOAuthUser(githubDto);

      expect(result.githubId).toBe(githubDto.providerId);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          githubId: githubDto.providerId,
          isEmailVerified: true,
          lastLoginAt: expect.any(Date),
        },
      });
    });

    it('完全な新規Googleユーザーを作成すること', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        ...mockUser,
        email: googleDto.email,
        name: googleDto.name,
        avatar: googleDto.avatar,
        googleId: googleDto.providerId,
        isEmailVerified: true,
      });

      const result = await service.validateOAuthUser(googleDto);

      expect(result.googleId).toBe(googleDto.providerId);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: googleDto.email,
          name: googleDto.name,
          avatar: googleDto.avatar,
          googleId: googleDto.providerId,
          isEmailVerified: true,
          lastLoginAt: expect.any(Date),
        },
      });
    });

    it('完全な新規GitHubユーザーを作成すること', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        ...mockUser,
        email: githubDto.email,
        name: githubDto.name,
        githubId: githubDto.providerId,
        isEmailVerified: true,
      });

      const result = await service.validateOAuthUser(githubDto);

      expect(result.githubId).toBe(githubDto.providerId);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: githubDto.email,
          name: githubDto.name,
          avatar: undefined,
          githubId: githubDto.providerId,
          isEmailVerified: true,
          lastLoginAt: expect.any(Date),
        },
      });
    });
  });

  describe('generateAccessToken', () => {
    it('JWTアクセストークンを生成すること', () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      mockJwtService.sign.mockReturnValue('jwt-token');

      const result = service.generateAccessToken(user);

      expect(result).toBe('jwt-token');
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: user.id, email: user.email },
        { expiresIn: '1h' },
      );
    });
  });

  describe('generateRefreshToken', () => {
    it('リフレッシュトークンを生成すること', () => {
      const token1 = service.generateRefreshToken();
      const token2 = service.generateRefreshToken();

      expect(token1).toBeDefined();
      expect(typeof token1).toBe('string');
      expect(token1.length).toBeGreaterThan(0);
      // 各トークンは一意であること
      expect(token1).not.toBe(token2);
    });
  });

  describe('login', () => {
    it('ログインレスポンスを生成してセッションを作成すること', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
      };
      const deviceInfo = {
        userAgent: 'Mozilla/5.0',
        ip: '127.0.0.1',
      };

      mockJwtService.sign.mockReturnValue('access-token');
      mockSessionService.createSession.mockResolvedValue('session-123');

      const result = await service.login(user, deviceInfo);

      expect(result).toEqual({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
        },
        accessToken: 'access-token',
        refreshToken: expect.any(String),
        sessionId: 'session-123',
      });
      expect(sessionService.createSession).toHaveBeenCalledWith(
        user.id,
        'access-token',
        expect.any(String),
        604800,
        deviceInfo,
      );
    });

    it('デバイス情報なしでログインできること', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockJwtService.sign.mockReturnValue('access-token');
      mockSessionService.createSession.mockResolvedValue('session-456');

      const result = await service.login(user);

      expect(result.sessionId).toBe('session-456');
      expect(sessionService.createSession).toHaveBeenCalledWith(
        user.id,
        'access-token',
        expect.any(String),
        604800,
        undefined,
      );
    });
  });

  describe('refreshAccessToken', () => {
    it('リフレッシュトークンから新しいアクセストークンを発行すること', async () => {
      const refreshToken = 'valid-refresh-token';
      const sessionId = 'session-123';
      const session = {
        userId: mockUser.id,
        accessToken: 'old-access-token',
        refreshToken,
        expiresAt: Date.now() + 86400000, // 1日後
      };

      mockSessionService.findSessionByRefreshToken.mockResolvedValue({
        sessionId,
        session,
      });
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('new-access-token');

      const result = await service.refreshAccessToken(refreshToken);

      expect(result).toEqual({
        accessToken: 'new-access-token',
      });
      expect(sessionService.updateSession).toHaveBeenCalledWith(sessionId, 'new-access-token');
    });

    it('無効なリフレッシュトークンの場合はUnauthorizedExceptionをスローすること', async () => {
      mockSessionService.findSessionByRefreshToken.mockResolvedValue(null);

      await expect(service.refreshAccessToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshAccessToken('invalid-token')).rejects.toThrow(
        '無効なリフレッシュトークンです',
      );
    });

    it('セッションの有効期限が切れている場合はUnauthorizedExceptionをスローすること', async () => {
      const refreshToken = 'expired-refresh-token';
      const sessionId = 'session-123';
      const expiredSession = {
        userId: mockUser.id,
        accessToken: 'old-access-token',
        refreshToken,
        expiresAt: Date.now() - 1000, // 過去
      };

      mockSessionService.findSessionByRefreshToken.mockResolvedValue({
        sessionId,
        session: expiredSession,
      });

      await expect(service.refreshAccessToken(refreshToken)).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshAccessToken(refreshToken)).rejects.toThrow(
        'セッションの有効期限が切れています',
      );
      expect(sessionService.deleteSession).toHaveBeenCalledWith(sessionId);
    });

    it('ユーザーが見つからない場合はUnauthorizedExceptionをスローすること', async () => {
      const refreshToken = 'valid-refresh-token';
      const sessionId = 'session-123';
      const session = {
        userId: 'nonexistent-user',
        accessToken: 'old-access-token',
        refreshToken,
        expiresAt: Date.now() + 86400000,
      };

      mockSessionService.findSessionByRefreshToken.mockResolvedValue({
        sessionId,
        session,
      });
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.refreshAccessToken(refreshToken)).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshAccessToken(refreshToken)).rejects.toThrow(
        'ユーザーが見つかりません',
      );
    });

    it('ユーザーが無効化されている場合はUnauthorizedExceptionをスローすること', async () => {
      const refreshToken = 'valid-refresh-token';
      const sessionId = 'session-123';
      const session = {
        userId: mockUser.id,
        accessToken: 'old-access-token',
        refreshToken,
        expiresAt: Date.now() + 86400000,
      };

      mockSessionService.findSessionByRefreshToken.mockResolvedValue({
        sessionId,
        session,
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        status: 'suspended',
      });

      await expect(service.refreshAccessToken(refreshToken)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('セッションを削除すること', async () => {
      const sessionId = 'session-123';

      await service.logout(sessionId);

      expect(sessionService.deleteSession).toHaveBeenCalledWith(sessionId);
    });
  });

  describe('logoutAllSessions', () => {
    it('ユーザーの全セッションを削除すること', async () => {
      const userId = 'user-123';

      await service.logoutAllSessions(userId);

      expect(sessionService.deleteAllUserSessions).toHaveBeenCalledWith(userId);
    });
  });
});
