import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { SlackDispatcherService } from './slack-dispatcher.service';
import { PrismaService } from '../prisma.service';
import { DispatchToSlackDto } from './dto/dispatch-to-slack.dto';

@Processor('slack-dispatch')
export class SlackDispatcherProcessor {
  private readonly logger = new Logger(SlackDispatcherProcessor.name);

  constructor(
    private readonly slackDispatcherService: SlackDispatcherService,
    private readonly prisma: PrismaService,
  ) {}

  @Process('send-dm')
  async handleSendDM(job: Job<DispatchToSlackDto>) {
    const { factId } = job.data;

    this.logger.log(`Queue Job開始: Fact ID=${factId}, Attempt=${job.attemptsMade + 1}`);

    try {
      // Fact を取得
      const fact = await this.prisma.fact.findUnique({
        where: { id: factId },
      });

      if (!fact) {
        this.logger.error(`Fact not found: ID=${factId}`);
        throw new Error(`Fact not found: ${factId}`);
      }

      // 既にSlack投稿済みの場合はスキップ
      if (fact.slackMessageId) {
        this.logger.warn(`Fact already posted to Slack: ID=${factId}, ts=${fact.slackMessageId}`);
        return;
      }

      // Slack DM投稿
      const messageTs = await this.slackDispatcherService.postFactToDM(fact);

      // slackMessageId と processedAt を更新
      await this.prisma.fact.update({
        where: { id: factId },
        data: {
          slackMessageId: messageTs,
          processedAt: new Date(),
        },
      });

      this.logger.log(`Slack投稿完了: Fact ID=${factId}, ts=${messageTs}`);
    } catch (error) {
      this.logger.error(
        `Slack投稿失敗: Fact ID=${factId}, Attempt=${job.attemptsMade + 1}`,
        error.stack,
      );
      throw error; // リトライさせるため再スロー
    }
  }
}
