import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  Res,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * メール/パスワードで新規登録
   */
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * メール/パスワードでログイン
   */
  @Post('login')
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

    // フロントエンドにリダイレクト
    res.redirect(
      `${process.env.WEB_URL}/auth/callback?accessToken=${loginData.accessToken}&refreshToken=${loginData.refreshToken}`,
    );
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

    res.redirect(
      `${process.env.WEB_URL}/auth/callback?accessToken=${loginData.accessToken}&refreshToken=${loginData.refreshToken}`,
    );
  }

  /**
   * トークンリフレッシュ
   */
  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshAccessToken(refreshToken);
  }

  /**
   * ログアウト
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Body('sessionId') sessionId: string) {
    await this.authService.logout(sessionId);
    return { message: 'ログアウトしました' };
  }

  /**
   * 全セッションログアウト
   */
  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  async logoutAll(@Req() req: Request) {
    const user = req.user as any;
    await this.authService.logoutAllSessions(user.id);
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
