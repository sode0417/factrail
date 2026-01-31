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
    this.redisClient = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get('REDIS_SESSION_DB', 1), // 専用DB使用
    });
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

    await this.redisClient.setex(
      `session:${sessionId}`,
      ttl,
      JSON.stringify(sessionData),
    );

    // ユーザーのセッション一覧にも追加
    await this.redisClient.sadd(`user_sessions:${userId}`, sessionId);

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
  async updateSession(
    sessionId: string,
    accessToken: string,
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.accessToken = accessToken;
      const ttl = await this.redisClient.ttl(`session:${sessionId}`);
      await this.redisClient.setex(
        `session:${sessionId}`,
        ttl,
        JSON.stringify(session),
      );
    }
  }

  /**
   * セッション削除（ログアウト）
   */
  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      await this.redisClient.del(`session:${sessionId}`);
      await this.redisClient.srem(`user_sessions:${session.userId}`, sessionId);
    }
  }

  /**
   * ユーザーの全セッション削除
   */
  async deleteAllUserSessions(userId: string): Promise<void> {
    const sessionIds = await this.redisClient.smembers(`user_sessions:${userId}`);
    const pipeline = this.redisClient.pipeline();

    sessionIds.forEach((sessionId) => {
      pipeline.del(`session:${sessionId}`);
    });

    pipeline.del(`user_sessions:${userId}`);
    await pipeline.exec();
  }

  /**
   * リフレッシュトークンからセッション検索
   */
  async findSessionByRefreshToken(refreshToken: string): Promise<{ sessionId: string; session: SessionData } | null> {
    // 全セッションを検索（本番環境では最適化が必要）
    const keys = await this.redisClient.keys('session:*');

    for (const key of keys) {
      const data = await this.redisClient.get(key);
      if (data) {
        const session: SessionData = JSON.parse(data);
        if (session.refreshToken === refreshToken) {
          return {
            sessionId: key.replace('session:', ''),
            session,
          };
        }
      }
    }

    return null;
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}
