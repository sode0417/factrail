import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiKeyGuard } from './api-key.guard';

/**
 * JWT 認証ガード（API キー認証フォールバック付き）
 *
 * 認証の優先順序:
 * 1. X-API-Key ヘッダー → API キー認証
 * 2. Authorization: Bearer <token> → JWT 認証
 * 3. Cookie: f2a_token=<token> → F2A SSO (JWT 認証)
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private apiKeyGuard: ApiKeyGuard) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // API キーが提供されている場合はそちらを優先
    const request = context.switchToHttp().getRequest();
    if (request.headers['x-api-key']) {
      return this.apiKeyGuard.canActivate(context);
    }

    // JWT 認証（Bearer トークン or Cookie）
    return super.canActivate(context) as Promise<boolean>;
  }
}
