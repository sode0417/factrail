import { Controller, Get } from '@nestjs/common';

/**
 * アプリケーションのルートコントローラー
 */
@Controller()
export class AppController {
  /**
   * API稼働確認用のエンドポイント
   * @returns APIの稼働状態メッセージ
   */
  @Get()
  getHello(): string {
    return 'Factrail API is running';
  }
}
