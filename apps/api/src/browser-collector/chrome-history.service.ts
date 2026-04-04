import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BetterSqlite3 = require('better-sqlite3');

export interface ChromeVisit {
  url: string;
  title: string;
  visitTime: Date;
  transitionType: number;
}

/** WebKit epoch (1601-01-01) と Unix epoch (1970-01-01) の差分（マイクロ秒） */
const WEBKIT_EPOCH_OFFSET = 11644473600000000n;

const LAST_RUN_FILE = '/tmp/browser-collector-last-run.json';
const COPY_DB_PATH = '/tmp/chrome-history-copy.db';

@Injectable()
export class ChromeHistoryService {
  private readonly logger = new Logger(ChromeHistoryService.name);
  private readonly chromeProfilePath: string;

  constructor(private readonly configService: ConfigService) {
    const configPath = this.configService.get<string>('CHROME_PROFILE_PATH');
    if (configPath) {
      // ~ をホームディレクトリに展開
      this.chromeProfilePath = configPath.startsWith('~')
        ? path.join(os.homedir(), configPath.slice(1))
        : configPath;
    } else {
      this.chromeProfilePath = path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'Google',
        'Chrome',
        'Default',
      );
    }
  }

  /**
   * 前回取得時刻以降の Chrome 訪問履歴を取得する
   */
  fetchNewVisits(): ChromeVisit[] {
    const historyDbPath = path.join(this.chromeProfilePath, 'History');

    if (!fs.existsSync(historyDbPath)) {
      this.logger.warn(`Chrome History DB が見つかりません: ${historyDbPath}`);
      return [];
    }

    // Chrome がロック中のため、コピーしてから読取
    fs.copyFileSync(historyDbPath, COPY_DB_PATH);

    // 前回取得時刻がなければ直近1時間分のみ取得
    const lastRunTime = this.getLastRunTime() ?? new Date(Date.now() - 60 * 60 * 1000);
    const lastRunWebkit = this.dateToWebkitTimestamp(lastRunTime);

    this.logger.log(`履歴を取得します（前回: ${lastRunTime.toISOString()}）`);

    let db: any = null;
    try {
      db = new BetterSqlite3(COPY_DB_PATH, { readonly: true });

      const rows = db
        .prepare(
          `
          SELECT u.url, u.title, v.visit_time, v.transition
          FROM visits v
          JOIN urls u ON v.url = u.id
          WHERE v.visit_time > ?
          ORDER BY v.visit_time ASC
        `,
        )
        .all(lastRunWebkit.toString()) as Array<{
        url: string;
        title: string;
        visit_time: string;
        transition: number;
      }>;

      const visits: ChromeVisit[] = rows
        .map((row) => ({
          url: row.url,
          title: row.title || '',
          visitTime: this.webkitTimestampToDate(BigInt(row.visit_time)),
          transitionType: row.transition & 0xff, // 下位8ビットがコアタイプ
        }))
        .filter((v) => !this.isInternalUrl(v.url));

      this.logger.log(`${visits.length} 件の新しい訪問履歴を取得しました`);

      // 取得成功時に最終実行時刻を更新
      this.saveLastRunTime(new Date());

      return visits;
    } catch (error) {
      this.logger.error('Chrome History DB の読取に失敗しました', error);
      return [];
    } finally {
      db?.close();
      // コピーファイルを削除
      try {
        fs.unlinkSync(COPY_DB_PATH);
      } catch {
        // 削除失敗は無視
      }
    }
  }

  private webkitTimestampToDate(webkitTimestamp: bigint): Date {
    const unixMicroseconds = webkitTimestamp - WEBKIT_EPOCH_OFFSET;
    return new Date(Number(unixMicroseconds / 1000n));
  }

  private dateToWebkitTimestamp(date: Date): bigint {
    return BigInt(date.getTime()) * 1000n + WEBKIT_EPOCH_OFFSET;
  }

  private isInternalUrl(url: string): boolean {
    return (
      url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('devtools://') ||
      url.startsWith('about:') ||
      url.startsWith('chrome-search://')
    );
  }

  private getLastRunTime(): Date | null {
    try {
      if (!fs.existsSync(LAST_RUN_FILE)) return null;
      const data = JSON.parse(fs.readFileSync(LAST_RUN_FILE, 'utf-8'));
      return new Date(data.lastRunTime);
    } catch {
      return null;
    }
  }

  private saveLastRunTime(time: Date): void {
    fs.writeFileSync(LAST_RUN_FILE, JSON.stringify({ lastRunTime: time.toISOString() }));
  }
}
