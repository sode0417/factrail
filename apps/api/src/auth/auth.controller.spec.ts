import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { Request, Response } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshAccessToken: jest.fn(),
    logout: jest.fn(),
    logoutAllSessions: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    avatar: 'https://example.com/avatar.jpg',
  };

  const mockLoginData = {
    user: mockUser,
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    sessionId: 'session-123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    // Set environment variable for OAuth callbacks
    process.env.WEB_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('新規ユーザーを登録すること', async () => {
      const registerDto: RegisterDto = {
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
      };
      const expectedResult = {
        id: 'user-456',
        email: registerDto.email,
        name: registerDto.name,
      };

      mockAuthService.register.mockResolvedValue(expectedResult);

      const result = await controller.register(registerDto);

      expect(result).toEqual(expectedResult);
      expect(authService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('login', () => {
    it('メール/パスワードでログインすること', async () => {
      const mockRequest = {
        user: mockUser,
        ip: '127.0.0.1',
      } as unknown as Request;
      const userAgent = 'Mozilla/5.0';

      mockAuthService.login.mockResolvedValue(mockLoginData);

      const result = await controller.login(mockRequest, userAgent);

      expect(result).toEqual(mockLoginData);
      expect(authService.login).toHaveBeenCalledWith(mockUser, {
        userAgent,
        ip: '127.0.0.1',
      });
    });

    it('user-agentヘッダーなしでログインすること', async () => {
      const mockRequest = {
        user: mockUser,
        ip: '192.168.1.1',
      } as unknown as Request;

      mockAuthService.login.mockResolvedValue(mockLoginData);

      const result = await controller.login(mockRequest);

      expect(result).toEqual(mockLoginData);
      expect(authService.login).toHaveBeenCalledWith(mockUser, {
        userAgent: undefined,
        ip: '192.168.1.1',
      });
    });
  });

  describe('googleAuth', () => {
    it('Google OAuth開始エンドポイントが定義されていること', async () => {
      const result = await controller.googleAuth();

      expect(result).toBeUndefined();
    });
  });

  describe('googleAuthCallback', () => {
    it('Google OAuthコールバックを処理してリダイレクトすること', async () => {
      const mockRequest = {
        user: mockUser,
        ip: '127.0.0.1',
      } as unknown as Request;
      const mockResponse = {
        redirect: jest.fn(),
        cookie: jest.fn(),
      } as unknown as Response;
      const userAgent = 'Mozilla/5.0';

      mockAuthService.login.mockResolvedValue(mockLoginData);

      await controller.googleAuthCallback(mockRequest, mockResponse, userAgent);

      expect(authService.login).toHaveBeenCalledWith(mockUser, {
        userAgent,
        ip: '127.0.0.1',
      });
      // セキュアクッキーにトークンを設定
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'accessToken',
        mockLoginData.accessToken,
        expect.any(Object),
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        mockLoginData.refreshToken,
        expect.any(Object),
      );
      // クエリパラメータなしでリダイレクト
      expect(mockResponse.redirect).toHaveBeenCalledWith('http://localhost:3000/auth/callback');
    });

    it('user-agentヘッダーなしでGoogle OAuthコールバックを処理すること', async () => {
      const mockRequest = {
        user: mockUser,
        ip: '10.0.0.1',
      } as unknown as Request;
      const mockResponse = {
        redirect: jest.fn(),
        cookie: jest.fn(),
      } as unknown as Response;

      mockAuthService.login.mockResolvedValue(mockLoginData);

      await controller.googleAuthCallback(mockRequest, mockResponse);

      expect(authService.login).toHaveBeenCalledWith(mockUser, {
        userAgent: undefined,
        ip: '10.0.0.1',
      });
      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
      expect(mockResponse.redirect).toHaveBeenCalledWith('http://localhost:3000/auth/callback');
    });
  });

  describe('githubAuth', () => {
    it('GitHub OAuth開始エンドポイントが定義されていること', async () => {
      const result = await controller.githubAuth();

      expect(result).toBeUndefined();
    });
  });

  describe('githubAuthCallback', () => {
    it('GitHub OAuthコールバックを処理してリダイレクトすること', async () => {
      const mockRequest = {
        user: mockUser,
        ip: '127.0.0.1',
      } as unknown as Request;
      const mockResponse = {
        redirect: jest.fn(),
        cookie: jest.fn(),
      } as unknown as Response;
      const userAgent = 'Mozilla/5.0';

      mockAuthService.login.mockResolvedValue(mockLoginData);

      await controller.githubAuthCallback(mockRequest, mockResponse, userAgent);

      expect(authService.login).toHaveBeenCalledWith(mockUser, {
        userAgent,
        ip: '127.0.0.1',
      });
      // セキュアクッキーにトークンを設定
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'accessToken',
        mockLoginData.accessToken,
        expect.any(Object),
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        mockLoginData.refreshToken,
        expect.any(Object),
      );
      // クエリパラメータなしでリダイレクト
      expect(mockResponse.redirect).toHaveBeenCalledWith('http://localhost:3000/auth/callback');
    });

    it('user-agentヘッダーなしでGitHub OAuthコールバックを処理すること', async () => {
      const mockRequest = {
        user: mockUser,
        ip: '172.16.0.1',
      } as unknown as Request;
      const mockResponse = {
        redirect: jest.fn(),
        cookie: jest.fn(),
      } as unknown as Response;

      mockAuthService.login.mockResolvedValue(mockLoginData);

      await controller.githubAuthCallback(mockRequest, mockResponse);

      expect(authService.login).toHaveBeenCalledWith(mockUser, {
        userAgent: undefined,
        ip: '172.16.0.1',
      });
      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
      expect(mockResponse.redirect).toHaveBeenCalledWith('http://localhost:3000/auth/callback');
    });
  });

  describe('refresh', () => {
    it('リフレッシュトークンから新しいアクセストークンを取得すること', async () => {
      const refreshToken = 'valid-refresh-token';
      const expectedResult = {
        accessToken: 'new-access-token',
      };
      const mockRequest = {
        cookies: {},
      } as unknown as Request;

      mockAuthService.refreshAccessToken.mockResolvedValue(expectedResult);

      const result = await controller.refresh(refreshToken, mockRequest);

      expect(result).toEqual(expectedResult);
      expect(authService.refreshAccessToken).toHaveBeenCalledWith(refreshToken);
    });
  });

  describe('logout', () => {
    it('指定されたセッションからログアウトすること', async () => {
      const sessionId = 'session-123';
      const mockResponse = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      const result = await controller.logout(sessionId, mockResponse);

      expect(result).toEqual({ message: 'ログアウトしました' });
      expect(authService.logout).toHaveBeenCalledWith(sessionId);
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('accessToken', expect.any(Object));
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refreshToken', expect.any(Object));
    });
  });

  describe('logoutAll', () => {
    it('全てのセッションからログアウトすること', async () => {
      const mockRequest = {
        user: mockUser,
      } as unknown as Request;
      const mockResponse = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      const result = await controller.logoutAll(mockRequest, mockResponse);

      expect(result).toEqual({ message: '全てのセッションからログアウトしました' });
      expect(authService.logoutAllSessions).toHaveBeenCalledWith(mockUser.id);
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('accessToken', expect.any(Object));
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refreshToken', expect.any(Object));
    });
  });

  describe('getProfile', () => {
    it('現在のユーザー情報を取得すること', async () => {
      const mockRequest = {
        user: mockUser,
      } as unknown as Request;

      const result = await controller.getProfile(mockRequest);

      expect(result).toEqual(mockUser);
    });
  });
});
