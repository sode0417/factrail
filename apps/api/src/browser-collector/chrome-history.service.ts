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
type DatabaseSyncCtor = new (
  path: string,
  options: { readOnly: boolean; readBigInts: boolean },
) => SqliteDatabase;

/**
 * node:sqlite は使う直前に読み込む。⭐ 読み込めない Node で起動しても api 全体は落とさず、
 * browser 収集だけが失敗として記録される（#195 の経路に乗せる）
 */
function loadDatabaseSync(): DatabaseSyncCtor {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('node:sqlite') as { DatabaseSync: DatabaseSyncCtor }).DatabaseSync;
}

export interface ChromeVisit {
  url: string;
  title: string;
  visitTime: Date;
  transitionType: number;
}

/** WebKit epoch (1601-01-01) と Unix epoch (1970-01-01) の差分（マイクロ秒） */
const WEBKIT_EPOCH_OFFSET = 11644473600000000n;

/**
 * 前回取得時刻とコピーした DB を置く場所。⭐ /tmp は再起動や macOS の掃除で消え、消えると
 * 直近 1 時間分しか取れずにそれより前の履歴を落とすので、消えない場所に置く（#195 の残り）。
 * BROWSER_COLLECTOR_STATE_DIR で変えられる（テストは一時ディレクトリを渡す）
 */
const DEFAULT_STATE_DIR = path.join(os.homedir(), '.local', 'state', 'factrail');
const LAST_RUN_FILE_NAME = 'browser-collector-last-run.json';
const COPY_DB_FILE_NAME = 'chrome-history-copy.db';
/** 以前の置き場。移した直後の 1 回だけ読み、そこから続ける（移したせいで 1 時間に落とさない） */
const LEGACY_LAST_RUN_FILE = '/tmp/browser-collector-last-run.json';

@Injectable()
export class ChromeHistoryService {
  private readonly logger = new Logger(ChromeHistoryService.name);
  private readonly chromeProfilePath: string;
  private readonly stateDir: string;
  private readonly usesDefaultStateDir: boolean;

  constructor(private readonly configService: ConfigService) {
    const stateDir = this.configService.get<string>('BROWSER_COLLECTOR_STATE_DIR');
    this.usesDefaultStateDir = !stateDir;
    this.stateDir = stateDir
      ? stateDir.startsWith('~')
        ? path.join(os.homedir(), stateDir.slice(1))
        : stateDir
      : DEFAULT_STATE_DIR;

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
    fs.mkdirSync(this.stateDir, { recursive: true });
    fs.copyFileSync(historyDbPath, this.copyDbPath);

    // 前回取得時刻がなければ直近1時間分のみ取得
    let lastRunTime = this.getLastRunTime();
    if (!lastRunTime) {
      lastRunTime = new Date(Date.now() - 60 * 60 * 1000);
      // 黙って 1 時間前に落とすと、それより前の履歴が失われたことに誰も気づけない（#195）
      this.logger.warn(
        `前回取得時刻（${this.lastRunFile}）が見つからないため、直近 1 時間分だけ取得します。それより前の履歴は取得されません`,
      );
    }
    const lastRunWebkit = this.dateToWebkitTimestamp(lastRunTime);

    this.logger.log(`履歴を取得します（前回: ${lastRunTime.toISOString()}）`);

    // 読取の失敗はそのまま投げ、呼び出し元の BrowserCollectorService がログと失敗の記録を行う
    let db: SqliteDatabase | null = null;
    try {
      // ⭐ visit_time は 2^53 を超える（WebKit 時刻のマイクロ秒）ので BigInt のまま読む
      const DatabaseSync = loadDatabaseSync();
      db = new DatabaseSync(this.copyDbPath, { readOnly: true, readBigInts: true });

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
        fs.unlinkSync(this.copyDbPath);
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

  private get lastRunFile(): string {
    return path.join(this.stateDir, LAST_RUN_FILE_NAME);
  }

  private get copyDbPath(): string {
    return path.join(this.stateDir, COPY_DB_FILE_NAME);
  }

  private getLastRunTime(): Date | null {
    const candidates = [this.lastRunFile];
    // 置き場を設定で変えていないときだけ、以前の /tmp も見る（テストが本番のファイルを読まないように）
    if (this.usesDefaultStateDir) candidates.push(LEGACY_LAST_RUN_FILE);
    for (const file of candidates) {
      try {
        if (!fs.existsSync(file)) continue;
        const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
        const time = new Date(data.lastRunTime);
        if (!Number.isNaN(time.getTime())) return time;
      } catch {
        // 壊れていれば次の候補へ
      }
    }
    return null;
  }

  private saveLastRunTime(time: Date): void {
    fs.mkdirSync(this.stateDir, { recursive: true });
    fs.writeFileSync(this.lastRunFile, JSON.stringify({ lastRunTime: time.toISOString() }));
  }
}
