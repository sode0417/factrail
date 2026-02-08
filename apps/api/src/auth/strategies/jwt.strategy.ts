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
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
      passReqToCallback: true, // リクエストをコールバックに渡す
    });
  }

  async validate(req: Request, payload: { sub: string; email: string }) {
    // トークンを取得してブラックリストチェック
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (token && (await this.sessionService.isBlacklisted(token))) {
      throw new UnauthorizedException('トークンは無効化されています');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('ユーザーが見つかりません');
    }

    return user;
  }
}
