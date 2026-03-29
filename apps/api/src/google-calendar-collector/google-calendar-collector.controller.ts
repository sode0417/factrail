import { Controller, Post, HttpCode, UseGuards, Query } from '@nestjs/common';
import { GoogleCalendarCollectorService } from './google-calendar-collector.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('google-calendar-collector')
@UseGuards(JwtAuthGuard)
export class GoogleCalendarCollectorController {
  constructor(private readonly service: GoogleCalendarCollectorService) {}

  @Post('trigger/plan')
  @HttpCode(200)
  async triggerPlan() {
    await this.service.collectEvents('calendar.plan');
    return { message: 'Google Calendar plan 収集を実行しました' };
  }

  @Post('trigger/actual')
  @HttpCode(200)
  async triggerActual() {
    await this.service.collectEvents('calendar.actual');
    return { message: 'Google Calendar actual 収集を実行しました' };
  }

  @Post('trigger')
  @HttpCode(200)
  async trigger(@Query('type') type?: string) {
    const factType = type === 'plan' ? 'calendar.plan' : 'calendar.actual';
    await this.service.collectEvents(factType);
    return { message: `Google Calendar ${factType} 収集を実行しました` };
  }
}
