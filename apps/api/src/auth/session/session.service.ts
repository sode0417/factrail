import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface SessionData {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  deviceInfo?: {
    userAgent?: string;
    ip?: string;
  };
  createdAt: number;
}

@Injectable()
export class SessionService implements OnModuleInit {
  private redisClient: Redis;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get('REDIS_URL');

    if (redisUrl) {
      // REDIS_URLが設定されている場合はそれを使用（Railway等のクラウド環境）
      this.redisClient = new Redis(redisUrl, {
        db: this.configService.get('REDIS_SESSION_DB', 1), // 専用DB使用
        maxRetriesPerRequest: null, // Bull互換性のため
        enableReadyCheck: false,
        // TLS設定（RailwayのRedisはTLSを使用）
        tls: redisUrl.startsWith('rediss://') ? {} : undefined,
      });
    } else {
      // 個別の環境変数を使用（ローカル開発環境）
      this.redisClient = new Redis({
        host: this.configService.get('REDIS_HOST', 'localhost'),
        port: this.configService.get('REDIS_PORT', 6379),
        password: this.configService.get('REDIS_PASSWORD'),
        db: this.configService.get('REDIS_SESSION_DB', 1),
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
    }
  }

  /**
   * セッション作成
   */
  async createSession(
    userId: string,
    accessToken: string,
    refreshToken: string,
    ttl: number = 604800, // 7日間（秒）
    deviceInfo?: { userAgent?: string; ip?: string },
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    const sessionData: SessionData = {
      userId,
      accessToken,
      refreshToken,
      expiresAt: Date.now() + ttl * 1000,
      deviceInfo,
      createdAt: Date.now(),
    };

    // パイプラインで一括処理
    const pipeline = this.redisClient.pipeline();

    // セッションデータを保存
    pipeline.setex(`session:${sessionId}`, ttl, JSON.stringify(sessionData));

    // ユーザーのセッション一覧にも追加
    pipeline.sadd(`user_sessions:${userId}`, sessionId);

    // リフレッシュトークンからセッションIDへのインデックスを追加（O(1)検索用）
    const refreshTokenHash = this.hashToken(refreshToken);
    pipeline.setex(`refresh_token_index:${refreshTokenHash}`, ttl, sessionId);

    await pipeline.exec();

    return sessionId;
  }

  /**
   * セッション取得
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    const data = await this.redisClient.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * セッション更新（アクセストークンリフレッシュ時）
   */
  async updateSession(sessionId: string, accessToken: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.accessToken = accessToken;
      const ttl = await this.redisClient.ttl(`session:${sessionId}`);
      await this.redisClient.setex(`session:${sessionId}`, ttl, JSON.stringify(session));
    }
  }

  /**
   * セッション削除（ログアウト）
   */
  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      const pipeline = this.redisClient.pipeline();

      // セッションデータを削除
      pipeline.del(`session:${sessionId}`);

      // ユーザーセッション一覧から削除
      pipeline.srem(`user_sessions:${session.userId}`, sessionId);

      // リフレッシュトークンインデックスを削除
      const refreshTokenHash = this.hashToken(session.refreshToken);
      pipeline.del(`refresh_token_index:${refreshTokenHash}`);

      await pipeline.exec();
    }
  }

  /**
   * ユーザーの全セッション削除
   */
  async deleteAllUserSessions(userId: string): Promise<void> {
    const sessionIds = await this.redisClient.smembers(`user_sessions:${userId}`);

    // 各セッションのリフレッシュトークンインデックスも削除するため、セッションデータを取得
    const sessions = await Promise.all(
      sessionIds.map(async (sessionId) => {
        const session = await this.getSession(sessionId);
        return { sessionId, session };
      }),
    );

    const pipeline = this.redisClient.pipeline();

    sessions.forEach(({ sessionId, session }) => {
      // セッションデータを削除
      pipeline.del(`session:${sessionId}`);

      // リフレッシュトークンインデックスを削除
      if (session) {
        const refreshTokenHash = this.hashToken(session.refreshToken);
        pipeline.del(`refresh_token_index:${refreshTokenHash}`);
      }
    });

    // ユーザーセッション一覧を削除
    pipeline.del(`user_sessions:${userId}`);
    await pipeline.exec();
  }

  /**
   * リフレッシュトークンからセッション検索（O(1)インデックス検索）
   */
  async findSessionByRefreshToken(
    refreshToken: string,
  ): Promise<{ sessionId: string; session: SessionData } | null> {
    // インデックスからセッションIDを取得（O(1)）
    const refreshTokenHash = this.hashToken(refreshToken);
    const sessionId = await this.redisClient.get(`refresh_token_index:${refreshTokenHash}`);

    if (!sessionId) {
      return null;
    }

    // セッションデータを取得
    const session = await this.getSession(sessionId);
    if (!session) {
      // インデックスはあるがセッションが無い場合（不整合）、インデックスを削除
      await this.redisClient.del(`refresh_token_index:${refreshTokenHash}`);
      return null;
    }

    // リフレッシュトークンが一致することを確認（セキュリティチェック）
    if (session.refreshToken !== refreshToken) {
      return null;
    }

    return { sessionId, session };
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * トークンをブラックリストに追加
   * @param token JWTトークン
   * @param ttl 有効期限（秒）- トークンの残り有効期限と同じにする
   */
  async addToBlacklist(token: string, ttl: number = 900): Promise<void> {
    // トークンのハッシュをキーとして保存（トークン自体は長いため）
    const tokenHash = this.hashToken(token);
    await this.redisClient.setex(`blacklist:${tokenHash}`, ttl, '1');
  }

  /**
   * トークンがブラックリストに含まれているかチェック
   */
  async isBlacklisted(token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);
    const result = await this.redisClient.exists(`blacklist:${tokenHash}`);
    return result === 1;
  }

  /**
   * ユーザーの全トークンをブラックリストに追加
   * パスワード変更時などに使用
   */
  async blacklistAllUserTokens(userId: string): Promise<void> {
    const sessionIds = await this.redisClient.smembers(`user_sessions:${userId}`);

    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId);
      if (session) {
        // アクセストークンとリフレッシュトークンをブラックリストに追加
        // アクセストークン: 15分、リフレッシュトークン: 7日
        await this.addToBlacklist(session.accessToken, 900);
        await this.addToBlacklist(session.refreshToken, 604800);
      }
    }

    // 全セッションを削除
    await this.deleteAllUserSessions(userId);
  }

  /**
   * ワンタイム認証コードを保存
   */
  async storeAuthCode(
    code: string,
    data: Record<string, unknown>,
    ttl: number = 30,
  ): Promise<void> {
    await this.redisClient.setex(`auth_code:${code}`, ttl, JSON.stringify(data));
  }

  /**
   * ワンタイム認証コードを取得・削除（1回限り使用）
   */
  async getAndDeleteAuthCode(code: string): Promise<Record<string, unknown> | null> {
    const key = `auth_code:${code}`;
    const data = await this.redisClient.get(key);
    if (!data) {
      return null;
    }
    await this.redisClient.del(key);
    return JSON.parse(data);
  }

  /**
   * トークンのハッシュを生成（簡易版）
   */
  private hashToken(token: string): string {
    // 簡易的にトークンの一部を使用（本番では crypto.createHash を使用推奨）
    return token.slice(-32);
  }
}
