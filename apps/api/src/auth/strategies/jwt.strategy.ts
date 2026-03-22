import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../prisma.service';
import { SessionService } from '../session/session.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private sessionService: SessionService,
  ) {
    super({
      jwtFromRequest: (req: Request) => {
        // 1. Authorization: Bearer <token>
        const bearerToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
        if (bearerToken) return bearerToken;

        // 2. Cookie: f2a_token=<token> (F2A SSO)
        const cookies = req.headers.cookie;
        if (cookies) {
          const match = cookies.split(';').find((c: string) => c.trim().startsWith('f2a_token='));
          if (match) return match.trim().replace('f2a_token=', '');
        }

        return null;
      },
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: { sub: string; email?: string; username?: string }) {
    // Bearer トークンの場合のみブラックリストチェック（Cookie 経由の F2A JWT はスキップ）
    const bearerToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (bearerToken && (await this.sessionService.isBlacklisted(bearerToken))) {
      throw new UnauthorizedException('トークンは無効化されています');
    }

    // factrail ユーザーを検索
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (user && user.status === 'active') {
      return user;
    }

    // F2A JWT の場合: username (= email) で factrail ユーザーを検索
    if (payload.username) {
      const f2aUser = await this.prisma.user.findFirst({
        where: { email: payload.username, status: 'active' },
      });
      if (f2aUser) return f2aUser;
    }

    throw new UnauthorizedException('ユーザーが見つかりません');
  }
}
