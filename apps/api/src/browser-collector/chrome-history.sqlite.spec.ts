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

  const build = () =>
    new ChromeHistoryService({ get: jest.fn().mockReturnValue(dir) } as unknown as ConfigService);

  it('前回取得時刻より後の訪問だけを、NULL の題と下位 8 ビットを整えて返すこと', () => {
    fs.writeFileSync(
      path.join(dir, 'browser-collector-last-run.json'),
      JSON.stringify({ lastRunTime: '2026-10-29T02:00:00.000Z' }),
    );

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
    expect(fs.existsSync(path.join(dir, 'chrome-history-copy.db'))).toBe(false);
  });

  it('成功したら前回取得時刻を置き場に残し、次のインスタンス（再起動後）がそこから続けること', () => {
    fs.writeFileSync(
      path.join(dir, 'browser-collector-last-run.json'),
      JSON.stringify({ lastRunTime: '2026-10-29T00:00:00.000Z' }),
    );
    expect(build().fetchNewVisits()).toHaveLength(2);

    const saved = JSON.parse(
      fs.readFileSync(path.join(dir, 'browser-collector-last-run.json'), 'utf-8'),
    );
    expect(new Date(saved.lastRunTime).getTime()).toBeGreaterThan(
      Date.parse('2026-10-29T00:00:00Z'),
    );
    // 再起動を真似て作り直しても、保存した時刻より前の訪問は読み直さない
    expect(build().fetchNewVisits()).toEqual([]);
  });
});
