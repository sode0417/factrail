import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

@Injectable()
export class CryptoService implements OnModuleInit {
  private encryptionKey: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');
    if (!this.encryptionKey) {
      throw new Error(
        'ENCRYPTION_KEY 環境変数が設定されていません。' +
          '次のコマンドでキーを生成してください: openssl rand -hex 32',
      );
    }

    if (this.encryptionKey.length < 32) {
      throw new Error(
        'ENCRYPTION_KEY は32文字以上である必要があります。' +
          '次のコマンドでキーを生成してください: openssl rand -hex 32',
      );
    }
  }

  /**
   * scryptを使用して暗号化キーから派生キーを生成する
   */
  private deriveKey(salt: Buffer): Buffer {
    return scryptSync(this.encryptionKey, salt, KEY_LENGTH);
  }

  /**
   * 平文を暗号化し、base64エンコードされた文字列を返す
   * フォーマット: base64(salt + iv + authTag + ciphertext)
   */
  encrypt(plaintext: string): string {
    if (!plaintext) {
      return plaintext;
    }

    const salt = randomBytes(SALT_LENGTH);
    const key = this.deriveKey(salt);
    const iv = randomBytes(IV_LENGTH);

    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // 結合: salt + iv + authTag + ciphertext
    const combined = Buffer.concat([salt, iv, authTag, encrypted]);

    return combined.toString('base64');
  }

  /**
   * base64エンコードされた暗号文を復号化し、平文を返す
   */
  decrypt(encryptedText: string): string {
    if (!encryptedText) {
      return encryptedText;
    }

    try {
      const combined = Buffer.from(encryptedText, 'base64');

      // 各コンポーネントを抽出
      const salt = combined.subarray(0, SALT_LENGTH);
      const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
      const authTag = combined.subarray(
        SALT_LENGTH + IV_LENGTH,
        SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH,
      );
      const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

      const key = this.deriveKey(salt);

      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

      return decrypted.toString('utf8');
    } catch (error) {
      throw new Error(
        `データの復号化に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
      );
    }
  }

  /**
   * 文字列が暗号化されているかどうかを判定する（base64形式で正しい長さかどうか）
   */
  isEncrypted(text: string): boolean {
    if (!text) {
      return false;
    }

    try {
      const decoded = Buffer.from(text, 'base64');
      // 最小長: salt + iv + authTag + 少なくとも1バイトの暗号文
      const minLength = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH + 1;
      return decoded.length >= minLength;
    } catch {
      return false;
    }
  }
}
