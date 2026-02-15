import { Controller, Post, Body, Get, Req, Res, UseGuards, Headers } from '@nestjs/common';
import { Response, Request } from 'express';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { RegisterDto } from './dto/register.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';

// クッキー設定の共通オプション
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private integrationsService: IntegrationsService,
  ) {}

  /**
   * トークンをセキュアクッキーに設定する
   */
  private setTokenCookies(res: Response, accessToken: string, refreshToken: string): void {
    // アクセストークン: 15分
    res.cookie('accessToken', accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000, // 15分
    });

    // リフレッシュトークン: 7日
    res.cookie('refreshToken', refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7日
    });
  }

  /**
   * トークンクッキーをクリアする
   */
  private clearTokenCookies(res: Response): void {
    res.clearCookie('accessToken', COOKIE_OPTIONS);
    res.clearCookie('refreshToken', COOKIE_OPTIONS);
  }

  /**
   * メール/パスワードで新規登録
   * レート制限: 1分に5回まで（ブルートフォース対策）
   */
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * メール/パスワードでログイン
   * レート制限: 1分に5回まで（ブルートフォース対策）
   */
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(LocalAuthGuard)
  async login(@Req() req: Request, @Headers('user-agent') userAgent?: string) {
    const user = req.user as any;
    return this.authService.login(user, {
      userAgent,
      ip: req.ip,
    });
  }

  /**
   * Google OAuth開始
   */
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Passportがリダイレクト処理
  }

  /**
   * Google OAuthコールバック
   */
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('user-agent') userAgent?: string,
  ) {
    const user = req.user as any;
    const loginData = await this.authService.login(user, {
      userAgent,
      ip: req.ip,
    });

    // ワンタイム認証コードを生成してRedisに保存
    const code = await this.authService.createAuthCode(loginData);

    // フロントエンドにリダイレクト（コードをURLパラメータで送信）
    res.redirect(`${process.env.WEB_URL}/auth/callback?code=${code}`);
  }

  /**
   * GitHub OAuth開始
   */
  @Get('github')
  @UseGuards(AuthGuard('github'))
  async githubAuth() {
    // Passportがリダイレクト処理
  }

  /**
   * GitHub OAuthコールバック
   */
  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubAuthCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('user-agent') userAgent?: string,
  ) {
    const user = req.user as any;
    const loginData = await this.authService.login(user, {
      userAgent,
      ip: req.ip,
    });

    // GitHub Integrationレコードを作成/更新（Webhook受信時のユーザー特定に必要）
    if (user.githubUsername) {
      await this.integrationsService.upsert(user.id, {
        provider: 'github',
        accountId: user.githubUsername,
        accountName: user.githubUsername,
        accessToken: user.githubAccessToken,
        scope: ['user:email', 'read:user', 'repo'],
      });
    }

    // ワンタイム認証コードを生成してRedisに保存
    const code = await this.authService.createAuthCode(loginData);

    // フロントエンドにリダイレクト（コードをURLパラメータで送信）
    res.redirect(`${process.env.WEB_URL}/auth/callback?code=${code}`);
  }

  /**
   * ワンタイム認証コードをトークンに交換
   * フロントエンドがOAuthコールバック後にトークンを取得するために使用
   */
  @Post('exchange')
  async exchangeAuthCode(@Body('code') code: string) {
    return this.authService.exchangeAuthCode(code);
  }

  /**
   * トークンリフレッシュ
   */
  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string, @Req() req: Request) {
    // ボディにない場合はクッキーから取得
    const token = refreshToken || req.cookies?.refreshToken;
    return this.authService.refreshAccessToken(token);
  }

  /**
   * ログアウト
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Body('sessionId') sessionId: string, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(sessionId);
    this.clearTokenCookies(res);
    return { message: 'ログアウトしました' };
  }

  /**
   * 全セッションログアウト
   */
  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  async logoutAll(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = req.user as any;
    await this.authService.logoutAllSessions(user.id);
    this.clearTokenCookies(res);
    return { message: '全てのセッションからログアウトしました' };
  }

  /**
   * 現在のユーザー情報取得
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: Request) {
    return req.user;
  }
}
