import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Slack OAuth stateパラメータの生成と検証を行うサービス
 *
 * @remarks
 * stateパラメータには以下の情報を含める:
 * - ユーザーID
 * - タイムスタンプ（有効期限チェック用）
 * - ランダムなnonce（CSRF保護）
 * - HMAC署名（改ざん防止）
 */
@Injectable()
export class SlackOAuthStateService {
  private readonly STATE_EXPIRATION_MS = 10 * 60 * 1000; // 10分

  constructor() {}

  /**
   * OAuth用のstateパラメータを生成する
   *
   * @param userId - ユーザーID
   * @returns 署名付きのstateパラメータ（Base64エンコード）
   */
  generateState(userId: string): string {
    const timestamp = Date.now();
    const nonce = crypto.randomBytes(16).toString('hex');
    const payload = JSON.stringify({ userId, timestamp, nonce });

    // HMAC署名を生成
    const secret = this.getSecret();
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // ペイロードと署名を結合してBase64エンコード
    const state = Buffer.from(`${payload}.${signature}`).toString('base64url');

    return state;
  }

  /**
   * stateパラメータを検証してユーザーIDを抽出する
   *
   * @param state - OAuth callbackで受け取ったstateパラメータ
   * @returns ユーザーID
   * @throws UnauthorizedException - stateが無効または期限切れの場合
   */
  validateState(state: string): string {
    try {
      // Base64デコード
      const decoded = Buffer.from(state, 'base64url').toString('utf-8');
      const [payloadStr, signature] = decoded.split('.');

      if (!payloadStr || !signature) {
        throw new Error('Invalid state format');
      }

      // 署名検証
      const secret = this.getSecret();
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payloadStr)
        .digest('hex');

      if (signature !== expectedSignature) {
        throw new Error('Invalid signature');
      }

      // ペイロード解析
      const payload = JSON.parse(payloadStr);
      const { userId, timestamp } = payload;

      if (!userId || !timestamp) {
        throw new Error('Missing required fields in state');
      }

      // 有効期限チェック
      const now = Date.now();
      if (now - timestamp > this.STATE_EXPIRATION_MS) {
        throw new Error('State expired');
      }

      return userId;
    } catch (error) {
      throw new UnauthorizedException(
        `Invalid OAuth state parameter: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * HMAC署名用のシークレットキーを取得する
   *
   * @returns シークレットキー
   */
  private getSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }
    return secret;
  }
}
