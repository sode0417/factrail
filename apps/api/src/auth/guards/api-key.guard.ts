import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../prisma.service';

/**
 * API キー認証ガード（サービス間通信用）
 *
 * X-API-Key ヘッダーで認証。journal-agent 等のエージェントが使用。
 * API_KEYS 環境変数にカンマ区切りで許可キーを設定。
 *
 * このガードが通った場合、request.user にデフォルトユーザーを設定する。
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private apiKeys: string[];

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const keys = this.configService.get<string>('API_KEYS', '');
    this.apiKeys = keys
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.apiKeys.length === 0) return false;

    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'] as string;

    if (!apiKey || !this.apiKeys.includes(apiKey)) {
      return false;
    }

    // API キーが有効な場合、デフォルトユーザーを request.user に設定
    // FACTRAIL_USER_ID 環境変数で指定されたユーザー、またはデフォルトユーザーを使用
    const userId = this.configService.get<string>('FACTRAIL_USER_ID');
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (user) {
        (request as any).user = user;
        return true;
      }
    }

    // デフォルトユーザー（最初のアクティブユーザー）
    const defaultUser = await this.prisma.user.findFirst({
      where: { status: 'active' },
    });
    if (defaultUser) {
      (request as any).user = defaultUser;
      return true;
    }

    throw new UnauthorizedException('No valid user found for API key');
  }
}
