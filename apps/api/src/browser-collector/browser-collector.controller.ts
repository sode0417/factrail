import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BrowserCollectorService } from './browser-collector.service';

@Controller('browser-collector')
@UseGuards(JwtAuthGuard)
export class BrowserCollectorController {
  constructor(private readonly browserCollectorService: BrowserCollectorService) {}

  /**
   * ブラウザ履歴収集を手動でトリガーする
   */
  @Post('trigger')
  @HttpCode(200)
  async trigger() {
    await this.browserCollectorService.collectBrowserHistory();
    return { message: 'ブラウザ履歴収集を実行しました' };
  }
}
