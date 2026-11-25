import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthController } from './health.controller';
import { CronHealthService } from './cron-health.service';
import { PrismaService } from '../prisma.service';
import { BrowserCollectorService } from '../browser-collector/browser-collector.service';
import { ChromeHistoryService } from '../browser-collector/chrome-history.service';
import { SessionSplitterService } from '../browser-collector/session-splitter.service';
import { LlmService } from '../browser-collector/llm.service';

/**
 * #195 の受入条件「読み込めない状態を作り、検知されることを確かめる」を、本番機を壊さずに通しで見る。
 * ⭐ 差し替えるのは SQLite の部品の読み込み（node:sqlite）と DB・LLM・設定だけ。
 *    読取 → 収集の cron → 鮮度の記録 → /health は本物をつなぐ。
 *    単体のテストは各部品をモックで切っているので、つなぎ目の取りこぼしはここでしか見えない。
 *
 * 再現しているのは「部品の読み込みが例外を投げる」一般の場合。2026-08 は better-sqlite3 の
 * ネイティブ部品の ABI 不一致（ERR_DLOPEN_FAILED）だった。今の node:sqlite は Node 組み込みなので
 * 同じ形では起きないが、読み込みが投げたときの経路は同じ（loadDatabaseSync() は try の内側）。
 */
let mockLoadFails = false;
jest.mock('node:sqlite', () => {
  const actual = jest.requireActual('node:sqlite');
  return {
    get DatabaseSync() {
      if (mockLoadFails) {
        const error = new Error(
          'The module was compiled against a different Node.js version using NODE_MODULE_VERSION 141. ' +
            'This version of Node.js requires NODE_MODULE_VERSION 137.',
        ) as Error & { code: string };
        error.code = 'ERR_DLOPEN_FAILED';
        throw error;
      }
      return actual.DatabaseSync;
    },
  };
});

describe('#195 読み込みの失敗が /health の degraded まで届くこと（結合）', () => {
  let stateDir: string;
  let collector: BrowserCollectorService;
  let controller: HealthController;
  let logError: jest.SpyInstance;

  const mockPrisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    user: { findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    fact: { upsert: jest.fn() },
  };

  beforeEach(async () => {
    mockLoadFails = false;
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    // ⭐ Chrome のプロファイルも前回取得時刻も一時ディレクトリの中だけ（本番の置き場に触らない）
    stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'factrail-195-'));
    // 表はあるが訪問が 0 件の本物の History。読み込めれば「新しい訪問なし = 成功」になるので、
    // 読み込みの差し替えが効いていなければ下の degraded のテストは落ちる（偽の安心にしない）
    const { DatabaseSync } = jest.requireActual('node:sqlite');
    const db = new DatabaseSync(path.join(stateDir, 'History'));
    db.exec(`
      CREATE TABLE urls (id INTEGER PRIMARY KEY, url TEXT, title TEXT);
      CREATE TABLE visits (id INTEGER PRIMARY KEY, url INTEGER, visit_time INTEGER, transition INTEGER);
    `);
    db.close();

    const config: Record<string, string> = {
      BROWSER_COLLECTOR_ENABLED: 'true',
      CHROME_PROFILE_PATH: stateDir,
      BROWSER_COLLECTOR_STATE_DIR: path.join(stateDir, 'state'),
      BROWSER_COLLECTOR_LEGACY_LAST_RUN_FILE: path.join(stateDir, 'legacy-last-run.json'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        CronHealthService,
        BrowserCollectorService,
        ChromeHistoryService,
        { provide: ConfigService, useValue: { get: (key: string) => config[key] } },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SessionSplitterService, useValue: { splitIntoSessions: jest.fn() } },
        { provide: LlmService, useValue: { summarizeSession: jest.fn() } },
      ],
    }).compile();

    collector = module.get(BrowserCollectorService);
    controller = module.get(HealthController);
  });

  afterEach(() => {
    logError.mockRestore();
    fs.rmSync(stateDir, { recursive: true, force: true });
  });

  it('cron が回る前は ok（browser-collector は pending）', async () => {
    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.crons['browser-collector'].status).toBe('pending');
  });

  it('読み込めるときは、訪問 0 件でも healthy のまま（対照）', async () => {
    await collector.collectBrowserHistory();

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.crons['browser-collector'].status).toBe('healthy');
  });

  it('読み込みが例外を投げたら、cron は落ちずに 1 回目で /health が degraded になる', async () => {
    mockLoadFails = true;

    // cron の中で例外が外へ漏れない（api のプロセスは落ちない = 2026-08 と同じ条件）
    await expect(collector.collectBrowserHistory()).resolves.toBeUndefined();

    // 失敗の理由が読み込みの例外であること（ほかの理由の失敗と取り違えない）
    expect(logError).toHaveBeenCalledWith(
      'ブラウザ履歴収集に失敗しました',
      expect.objectContaining({ code: 'ERR_DLOPEN_FAILED' }),
    );

    const result = await controller.check();

    // 2026-08 は 7 日間 ok のままだった。今は 1 回目の失敗で degraded になる
    expect(result.status).toBe('degraded');
    expect(result.crons['browser-collector']).toEqual(
      expect.objectContaining({ status: 'stale', consecutiveFailures: 1, lastSuccessAt: null }),
    );
    // DB は生きているので unhealthy にはしない（deploy.sh のゲートは止めない）
    expect(result.services.database).toBe('healthy');
    // エラー文は /health に出さない
    expect(JSON.stringify(result)).not.toContain('NODE_MODULE_VERSION');
  });

  it('失敗が続けば連続失敗の回数が増える', async () => {
    mockLoadFails = true;
    await collector.collectBrowserHistory();
    await collector.collectBrowserHistory();

    const result = await controller.check();

    expect(result.crons['browser-collector'].consecutiveFailures).toBe(2);
  });
});
