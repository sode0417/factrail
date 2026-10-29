import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { ChromeHistoryService } from './chrome-history.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite');

/** WebKit 時刻（1601 年起点のマイクロ秒） */
const webkit = (d: Date, micros = 0n) => BigInt(d.getTime()) * 1000n + micros + 11644473600000000n;

/**
 * 本物の node:sqlite で、Chrome と同じ形の History を読む（SQL・BigInt・NULL の扱いを確かめる）。
 * ⭐ 置き場はすべて一時ディレクトリ。本番の ~/.local/state/factrail や /tmp には触らない
 */
describe('ChromeHistoryService（本物の SQLite で読む）', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-sqlite-'));
    const db = new DatabaseSync(path.join(dir, 'History'));
    db.exec(`
      CREATE TABLE urls (id INTEGER PRIMARY KEY, url TEXT, title TEXT);
      CREATE TABLE visits (id INTEGER PRIMARY KEY, url INTEGER, visit_time INTEGER, transition INTEGER);
    `);
    const insertUrl = db.prepare('INSERT INTO urls VALUES (?, ?, ?)');
    insertUrl.run(1, 'https://example.com/old', 'old');
    insertUrl.run(2, 'https://example.com/new', null);
    const insertVisit = db.prepare('INSERT INTO visits VALUES (?, ?, ?, ?)');
    insertVisit.run(1, 1, webkit(new Date('2026-10-29T01:00:00Z')), 1);
    insertVisit.run(2, 2, webkit(new Date('2026-10-29T03:00:00.123Z'), 456n), 0x30000008);
    db.close();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // ⭐ 置き場のキーはすべて一時ディレクトリを指す（書き忘れると本番の置き場に触るので、キーごとに書く）
  const build = () =>
    new ChromeHistoryService({
      get: (key: string) =>
        ({
          CHROME_PROFILE_PATH: dir,
          BROWSER_COLLECTOR_STATE_DIR: path.join(dir, 'state'),
          BROWSER_COLLECTOR_LEGACY_LAST_RUN_FILE: path.join(dir, 'legacy-last-run.json'),
        })[key],
    } as unknown as ConfigService);
  const lastRunFile = () => path.join(dir, 'state', 'browser-collector-last-run.json');
  const writeLastRun = (file: string, iso: string) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ lastRunTime: iso }));
  };

  it('前回取得時刻より後の訪問だけを、NULL の題と下位 8 ビットを整えて返すこと', () => {
    writeLastRun(lastRunFile(), '2026-10-29T02:00:00.000Z');

    const visits = build().fetchNewVisits();

    expect(visits).toEqual([
      {
        url: 'https://example.com/new',
        title: '',
        visitTime: new Date('2026-10-29T03:00:00.123Z'),
        transitionType: 8,
      },
    ]);
    // コピーは読み終えたら消える
    expect(fs.existsSync(path.join(dir, 'state', 'chrome-history-copy.db'))).toBe(false);
  });

  it('成功したら前回取得時刻を置き場に残し、次のインスタンス（再起動後）がそこから続けること', () => {
    writeLastRun(lastRunFile(), '2026-10-29T00:00:00.000Z');
    expect(build().fetchNewVisits()).toHaveLength(2);

    const saved = JSON.parse(fs.readFileSync(lastRunFile(), 'utf-8'));
    expect(new Date(saved.lastRunTime).getTime()).toBeGreaterThan(
      Date.parse('2026-10-29T00:00:00Z'),
    );
    // 再起動を真似て作り直しても、保存した時刻より前の訪問は読み直さない
    expect(build().fetchNewVisits()).toEqual([]);
  });

  it('今の置き場に無ければ、以前の置き場の時刻から続けること（移した直後）', () => {
    writeLastRun(path.join(dir, 'legacy-last-run.json'), '2026-10-29T02:00:00.000Z');

    expect(
      build()
        .fetchNewVisits()
        .map((v) => v.url),
    ).toEqual(['https://example.com/new']);
    // 次からは今の置き場に残る
    expect(fs.existsSync(lastRunFile())).toBe(true);
  });

  it('今の置き場が壊れていても、以前の置き場の古い値には戻らないこと', () => {
    writeLastRun(path.join(dir, 'legacy-last-run.json'), '2026-10-01T00:00:00.000Z');
    fs.mkdirSync(path.join(dir, 'state'), { recursive: true });
    fs.writeFileSync(lastRunFile(), '{壊れた');

    // 古い値（10/01）に戻ると 01:00 の訪問まで読み直す。戻らなければ直近 1 時間に落ちるので読まない
    const urls = build()
      .fetchNewVisits()
      .map((v) => v.url);
    expect(urls).not.toContain('https://example.com/old');
  });
});
