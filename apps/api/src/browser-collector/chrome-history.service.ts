import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
// ⭐ Node 組み込みの SQLite（ネイティブの依存を持たない）。2026-08 に better-sqlite3 の
//    ネイティブ部品が Node の版と合わず、browser 収集が 7 日止まった（#195）ため置き換えた。
//    @types/node が 20 系で node:sqlite の型を持たないので、使う分だけ型を書いて require する。
interface SqliteStatement {
  all(...params: unknown[]): unknown[];
}
interface SqliteDatabase {
  prepare(sql: string): SqliteStatement;
  close(): void;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (
    path: string,
    options: { readOnly: boolean; readBigInts: boolean },
  ) => SqliteDatabase;
};

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
   *
   * 読取に失敗したら例外を投げる。以前は空配列を返していたため「新しい訪問が無い」と区別できず、
   * better-sqlite3 の ABI 不一致で 7 日間止まっていたのに気づけなかった（#195）
   */
  fetchNewVisits(): ChromeVisit[] {
    const historyDbPath = path.join(this.chromeProfilePath, 'History');

    if (!fs.existsSync(historyDbPath)) {
      throw new Error(`Chrome History DB が見つかりません: ${historyDbPath}`);
    }

    // Chrome がロック中のため、コピーしてから読取
    fs.copyFileSync(historyDbPath, COPY_DB_PATH);

    // 前回取得時刻がなければ直近1時間分のみ取得
    let lastRunTime = this.getLastRunTime();
    if (!lastRunTime) {
      lastRunTime = new Date(Date.now() - 60 * 60 * 1000);
      // 黙って 1 時間前に落とすと、それより前の履歴が失われたことに誰も気づけない（#195）
      this.logger.warn(
        `前回取得時刻（${LAST_RUN_FILE}）が見つからないため、直近 1 時間分だけ取得します。それより前の履歴は取得されません`,
      );
    }
    const lastRunWebkit = this.dateToWebkitTimestamp(lastRunTime);

    this.logger.log(`履歴を取得します（前回: ${lastRunTime.toISOString()}）`);

    // 読取の失敗はそのまま投げ、呼び出し元の BrowserCollectorService がログと失敗の記録を行う
    let db: SqliteDatabase | null = null;
    try {
      // ⭐ visit_time は 2^53 を超える（WebKit 時刻のマイクロ秒）ので BigInt のまま読む
      db = new DatabaseSync(COPY_DB_PATH, { readOnly: true, readBigInts: true });

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
        .all(lastRunWebkit) as Array<{
        url: string;
        title: string | null;
        visit_time: bigint;
        transition: bigint;
      }>;

      const visits: ChromeVisit[] = rows
        .map((row) => ({
          url: row.url,
          title: row.title || '',
          visitTime: this.webkitTimestampToDate(row.visit_time),
          transitionType: Number(row.transition & 0xffn), // 下位8ビットがコアタイプ
        }))
        .filter((v) => !this.isInternalUrl(v.url));

      this.logger.log(`${visits.length} 件の新しい訪問履歴を取得しました`);

      // 取得成功時に最終実行時刻を更新
      this.saveLastRunTime(new Date());

      return visits;
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
