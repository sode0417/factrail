import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { SessionService } from './session/session.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { RegisterDto } from './dto/register.dto';

interface OAuthUserDto {
  provider: 'google' | 'github';
  providerId: string;
  email: string;
  name?: string;
  avatar?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private sessionService: SessionService,
  ) {}

  /**
   * メール/パスワードでユーザー登録
   */
  async register(dto: RegisterDto) {
    // メールアドレス重複チェック
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('このメールアドレスは既に登録されています');
    }

    // パスワードハッシュ化
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // ユーザー作成
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        isEmailVerified: false, // TODO: メール認証実装
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }

  /**
   * メール/パスワードでログイン検証
   */
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('メールアドレスまたはパスワードが正しくありません');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('メールアドレスまたはパスワードが正しくありません');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('アカウントが無効化されています');
    }

    // 最終ログイン日時を更新
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return user;
  }

  /**
   * OAuth認証でユーザー検証・作成
   */
  async validateOAuthUser(dto: OAuthUserDto) {
    // 既存ユーザーを検索
    let user = await this.prisma.user.findUnique({
      where:
        dto.provider === 'google' ? { googleId: dto.providerId } : { githubId: dto.providerId },
    });

    // 新規ユーザーの場合は作成
    if (!user) {
      // メールアドレスで既存ユーザーを検索（アカウント統合）
      const existingUser = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (existingUser) {
        // 既存アカウントにOAuth連携を追加
        user = await this.prisma.user.update({
          where: { id: existingUser.id },
          data:
            dto.provider === 'google'
              ? {
                  googleId: dto.providerId,
                  isEmailVerified: true,
                  lastLoginAt: new Date(),
                }
              : {
                  githubId: dto.providerId,
                  isEmailVerified: true,
                  lastLoginAt: new Date(),
                },
        });
      } else {
        // 新規ユーザー作成
        user = await this.prisma.user.create({
          data:
            dto.provider === 'google'
              ? {
                  email: dto.email,
                  name: dto.name,
                  avatar: dto.avatar,
                  googleId: dto.providerId,
                  isEmailVerified: true,
                  lastLoginAt: new Date(),
                }
              : {
                  email: dto.email,
                  name: dto.name,
                  avatar: dto.avatar,
                  githubId: dto.providerId,
                  isEmailVerified: true,
                  lastLoginAt: new Date(),
                },
        });
      }
    } else {
      // 最終ログイン日時を更新
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    return user;
  }

  /**
   * JWTアクセストークンを発行
   */
  generateAccessToken(user: { id: string; email: string }) {
    return this.jwtService.sign({ sub: user.id, email: user.email }, { expiresIn: '1h' });
  }

  /**
   * リフレッシュトークンを生成
   */
  generateRefreshToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * ログインレスポンス生成（セッション作成含む）
   */
  async login(
    user: { id: string; email: string; name?: string; avatar?: string },
    deviceInfo?: { userAgent?: string; ip?: string },
  ) {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();

    // Redisセッション作成
    const sessionId = await this.sessionService.createSession(
      user.id,
      accessToken,
      refreshToken,
      604800, // 7日間
      deviceInfo,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
      accessToken,
      refreshToken,
      sessionId,
    };
  }

  /**
   * リフレッシュトークンからアクセストークンを再発行
   */
  async refreshAccessToken(refreshToken: string) {
    const result = await this.sessionService.findSessionByRefreshToken(refreshToken);

    if (!result) {
      throw new UnauthorizedException('無効なリフレッシュトークンです');
    }

    const { sessionId, session } = result;

    // セッション有効期限チェック
    if (session.expiresAt < Date.now()) {
      await this.sessionService.deleteSession(sessionId);
      throw new UnauthorizedException('セッションの有効期限が切れています');
    }

    // ユーザー情報取得
    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('ユーザーが見つかりません');
    }

    // 新しいアクセストークン発行
    const newAccessToken = this.generateAccessToken(user);

    // セッション更新
    await this.sessionService.updateSession(sessionId, newAccessToken);

    return {
      accessToken: newAccessToken,
    };
  }

  /**
   * ログアウト（セッション削除）
   */
  async logout(sessionId: string) {
    await this.sessionService.deleteSession(sessionId);
  }

  /**
   * 全セッション削除（セキュリティ用）
   */
  async logoutAllSessions(userId: string) {
    await this.sessionService.deleteAllUserSessions(userId);
  }
}
