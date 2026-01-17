import {
  Controller,
  Post,
  Headers,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  /**
   * GitHub Webhook を受信する
   */
  @Post('github')
  @HttpCode(HttpStatus.OK)
  async handleGitHubWebhook(
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Headers('x-github-event') eventType: string | undefined,
    @Headers('x-github-delivery') deliveryId: string | undefined,
    @Req() req: Request,
    @Body() payload: Record<string, unknown>,
  ) {
    this.logger.log(
      `Received GitHub webhook: event=${eventType}, delivery=${deliveryId}`,
    );

    // Raw body を取得して署名検証
    const rawBody = JSON.stringify(payload);
    await this.webhooksService.verifyGitHubSignature(rawBody, signature);

    // イベント処理
    if (!eventType) {
      return { success: true, message: 'No event type specified' };
    }

    const result = await this.webhooksService.processGitHubEvent(
      eventType,
      payload as never,
    );

    if (result === null) {
      return { success: true, message: `Event ${eventType} acknowledged` };
    }

    return { success: true, ...result };
  }
}
