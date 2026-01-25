import { Injectable } from '@nestjs/common';

/**
 * アプリケーションのルートサービス
 */
@Injectable()
export class AppService {
  /**
   * 簡易的な動作確認メッセージを返す
   * @returns メッセージ
   */
  getHello(): string {
    return 'Hello World!';
  }
}
