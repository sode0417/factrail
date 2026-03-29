import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class GoogleCalendarCollectorService {
  private readonly logger = new Logger(GoogleCalendarCollectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 朝 JST 9:00 (UTC 0:00) に当日の予定をスナップショット（plan）
   */
  @Cron('0 0 * * *', { name: 'google-calendar-plan' })
  async collectPlan(): Promise<void> {
    await this.collectEvents('calendar.plan');
  }

  /**
   * 夜 JST 21:00 (UTC 12:00) に当日のイベントを再取得（actual）
   */
  @Cron('0 12 * * *', { name: 'google-calendar-actual' })
  async collectActual(): Promise<void> {
    await this.collectEvents('calendar.actual');
  }

  /**
   * 指定タイプでカレンダーイベントを収集
   */
  async collectEvents(factType: 'calendar.plan' | 'calendar.actual'): Promise<void> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const refreshToken = this.configService.get<string>('GOOGLE_CALENDAR_REFRESH_TOKEN');

    if (!clientId || !clientSecret || !refreshToken) {
      this.logger.debug('Google Calendar 認証情報が未設定のため、収集をスキップします');
      return;
    }

    this.logger.log(`Google Calendar イベント収集を開始します (type: ${factType})`);

    try {
      const auth = new google.auth.OAuth2(clientId, clientSecret);
      auth.setCredentials({ refresh_token: refreshToken });

      const calendar = google.calendar({ version: 'v3', auth });

      const { timeMin, timeMax } = this.getTodayRangeJST();
      const snapshotAt = new Date().toISOString();

      // カレンダー一覧を取得（購読中のカレンダー全て）
      const calendarList = await calendar.calendarList.list();
      const calendars = (calendarList.data.items || []).filter((cal) => cal.selected !== false);

      const userId = await this.resolveUserId();
      if (!userId) {
        this.logger.error('Fact を紐付けるユーザーが見つかりません');
        return;
      }

      let totalEvents = 0;

      for (const cal of calendars) {
        const calendarId = cal.id;
        if (!calendarId) continue;

        try {
          const events = await calendar.events.list({
            calendarId,
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: 'startTime',
          });

          const items = events.data.items || [];

          for (const event of items) {
            if (!event.id || event.status === 'cancelled') continue;

            await this.upsertEventFact(userId, {
              event,
              calendarId,
              calendarName: cal.summary || calendarId,
              factType,
              snapshotAt,
            });
            totalEvents++;
          }
        } catch (calError) {
          this.logger.warn(
            `カレンダー ${cal.summary || calendarId} のイベント取得に失敗: ${calError}`,
          );
        }
      }

      // plan 時に actual で消えたイベントを検出するため、
      // actual 収集時に plan にあって actual にないイベントをキャンセル扱いにする
      if (factType === 'calendar.actual') {
        await this.markCancelledEvents(userId, timeMin, timeMax, snapshotAt);
      }

      this.logger.log(
        `Google Calendar イベント収集が完了しました (${totalEvents} 件, type: ${factType})`,
      );
    } catch (error) {
      this.logger.error('Google Calendar イベント収集に失敗しました', error);
    }
  }

  /**
   * イベントを Fact として upsert
   */
  private async upsertEventFact(
    userId: string,
    params: {
      event: calendar_v3.Schema$Event;
      calendarId: string;
      calendarName: string;
      factType: string;
      snapshotAt: string;
    },
  ) {
    const { event, calendarId, calendarName, factType, snapshotAt } = params;

    const start = event.start?.dateTime || event.start?.date || '';
    const end = event.end?.dateTime || event.end?.date || '';
    const isAllDay = !event.start?.dateTime;

    const startTime = isAllDay ? this.formatDate(start) : this.formatTime(start);
    const endTime = isAllDay ? this.formatDate(end) : this.formatTime(end);

    const title = event.summary || '(無題)';
    const attendeeCount = (event.attendees || []).length;
    const myResponse = (event.attendees || []).find((a) => a.self)?.responseStatus;

    const externalId = `${calendarId}:${event.id}:${factType}`;

    const metadata = {
      calendarId,
      calendarName,
      eventId: event.id,
      start,
      end,
      startFormatted: startTime,
      endFormatted: endTime,
      isAllDay,
      location: event.location || null,
      description: event.description ? this.truncate(event.description, 500) : null,
      attendeeCount,
      myResponse: myResponse || null,
      status: event.status || 'confirmed',
      organizer: event.organizer?.email || null,
      hangoutLink: event.hangoutLink || null,
      snapshotAt,
    };

    const summary = isAllDay ? `${title} (終日)` : `${title} ${startTime}〜${endTime}`;

    const occurredAt = event.start?.dateTime
      ? new Date(event.start.dateTime)
      : new Date(start + 'T00:00:00+09:00');

    await this.prisma.fact.upsert({
      where: {
        source_externalId: {
          source: 'google-calendar',
          externalId,
        },
      },
      create: {
        userId,
        externalId,
        source: 'google-calendar',
        occurredAt,
        title: this.truncate(`[${calendarName}] ${title}`, 200),
        summary: this.truncate(summary, 200),
        content: event.description || null,
        raw: event as unknown as Prisma.InputJsonValue,
        type: factType,
        metadata: metadata as unknown as Prisma.InputJsonValue,
        groupId: `gcal:${calendarId}:${event.id}`,
        groupType: 'calendar_event',
      },
      update: {
        occurredAt,
        title: this.truncate(`[${calendarName}] ${title}`, 200),
        summary: this.truncate(summary, 200),
        content: event.description || null,
        raw: event as unknown as Prisma.InputJsonValue,
        type: factType,
        metadata: metadata as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * plan にあって actual にないイベントをキャンセル扱いで記録
   */
  private async markCancelledEvents(
    userId: string,
    timeMin: string,
    timeMax: string,
    snapshotAt: string,
  ): Promise<void> {
    // 当日の plan fact を取得
    const planFacts = await this.prisma.fact.findMany({
      where: {
        userId,
        source: 'google-calendar',
        type: 'calendar.plan',
        occurredAt: {
          gte: new Date(timeMin),
          lt: new Date(timeMax),
        },
      },
    });

    // 当日の actual fact の eventId を集める
    const actualFacts = await this.prisma.fact.findMany({
      where: {
        userId,
        source: 'google-calendar',
        type: 'calendar.actual',
        occurredAt: {
          gte: new Date(timeMin),
          lt: new Date(timeMax),
        },
      },
    });

    const actualEventIds = new Set(
      actualFacts
        .map((f) => {
          const meta = f.metadata as Record<string, unknown> | null;
          return meta?.eventId as string;
        })
        .filter(Boolean),
    );

    for (const planFact of planFacts) {
      const meta = planFact.metadata as Record<string, unknown> | null;
      const eventId = meta?.eventId as string;
      if (!eventId || actualEventIds.has(eventId)) continue;

      // actual に存在しない → キャンセルされた
      const cancelledExternalId = `${meta?.calendarId}:${eventId}:calendar.cancelled`;

      await this.prisma.fact.upsert({
        where: {
          source_externalId: {
            source: 'google-calendar',
            externalId: cancelledExternalId,
          },
        },
        create: {
          userId,
          externalId: cancelledExternalId,
          source: 'google-calendar',
          occurredAt: planFact.occurredAt,
          title: `[キャンセル] ${planFact.title}`,
          summary: `キャンセル: ${planFact.summary || planFact.title}`,
          content: null,
          raw: { originalPlanFactId: planFact.id } as Prisma.InputJsonValue,
          type: 'calendar.cancelled',
          metadata: {
            ...(meta || {}),
            status: 'cancelled',
            snapshotAt,
          } as Prisma.InputJsonValue,
          groupId: planFact.groupId,
          groupType: 'calendar_event',
        },
        update: {
          title: `[キャンセル] ${planFact.title}`,
          summary: `キャンセル: ${planFact.summary || planFact.title}`,
          metadata: {
            ...(meta || {}),
            status: 'cancelled',
            snapshotAt,
          } as Prisma.InputJsonValue,
        },
      });

      this.logger.log(`キャンセル検出: ${planFact.title}`);
    }
  }

  /**
   * 当日 JST 0:00〜翌日 0:00 の ISO 文字列を返す
   */
  private getTodayRangeJST(): { timeMin: string; timeMax: string } {
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const nowJST = new Date(now.getTime() + jstOffset);

    const startOfDayJST = new Date(
      Date.UTC(nowJST.getUTCFullYear(), nowJST.getUTCMonth(), nowJST.getUTCDate()) - jstOffset,
    );
    const endOfDayJST = new Date(startOfDayJST.getTime() + 24 * 60 * 60 * 1000);

    return {
      timeMin: startOfDayJST.toISOString(),
      timeMax: endOfDayJST.toISOString(),
    };
  }

  /**
   * システムの最初のユーザー ID を返す
   */
  private async resolveUserId(): Promise<string | null> {
    const user = await this.prisma.user.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  /**
   * ISO datetime から HH:MM 形式に変換
   */
  private formatTime(isoString: string): string {
    const date = new Date(isoString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * YYYY-MM-DD をそのまま返す
   */
  private formatDate(dateString: string): string {
    return dateString.split('T')[0];
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}
