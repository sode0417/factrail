import { Controller, Post, HttpCode, UseGuards } from '@nestjs/common';
import { SlackCollectorService } from './slack-collector.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('slack-collector')
@UseGuards(JwtAuthGuard)
export class SlackCollectorController {
  constructor(private readonly slackCollectorService: SlackCollectorService) {}

  @Post('trigger')
  @HttpCode(200)
  async trigger() {
    await this.slackCollectorService.collectSlackMessages();
    return { message: 'Slack DM 収集を実行しました' };
  }
}
