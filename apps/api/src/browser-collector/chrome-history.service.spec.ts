import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { ChromeHistoryService } from './chrome-history.service';

// node:sqlite の DatabaseSync を差し替える。開けない場合と、行を返す場合を切り替える
const mockOpen = jest.fn();
jest.mock('node:sqlite', () => ({
  DatabaseSync: jest.fn().mockImplementation((...args: unknown[]) => mockOpen(...args)),
}));

describe('ChromeHistoryService（失敗を握りつぶさない）', () => {
  let profileDir: string;

  beforeEach(() => {
    profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-profile-'));
    // ⭐ CHROME_PROFILE_PATH も BROWSER_COLLECTOR_STATE_DIR も profileDir を返すので、
    //    コピーと前回取得時刻はこの一時ディレクトリの中だけで起きる（本番の置き場に触らない）
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(profileDir, { recursive: true, force: true });
  });

  const build = () =>
    new ChromeHistoryService({
      get: (key: string) =>
        ({
          CHROME_PROFILE_PATH: profileDir,
          BROWSER_COLLECTOR_STATE_DIR: profileDir,
          BROWSER_COLLECTOR_LEGACY_LAST_RUN_FILE: path.join(profileDir, 'legacy-last-run.json'),
        })[key],
    } as unknown as ConfigService);

  it('DB が開けなければ例外を投げること（空配列で握りつぶさない）', () => {
    fs.writeFileSync(path.join(profileDir, 'History'), '');
    mockOpen.mockImplementation(() => {
      throw new Error('database disk image is malformed');
    });

    expect(() => build().fetchNewVisits()).toThrow('malformed');
  });

  it('読取専用・BigInt で開き、visit_time を精度を落とさずに日時へ変換すること', () => {
    fs.writeFileSync(path.join(profileDir, 'History'), '');
    // 2026-10-29T03:00:00.123456Z の WebKit 時刻（マイクロ秒。2^53 を超える）
    const visitTime =
      BigInt(Date.UTC(2026, 9, 29, 3, 0, 0, 123)) * 1000n + 456n + 11644473600000000n;
    const all = jest.fn().mockReturnValue([
      { url: 'https://example.com/a', title: null, visit_time: visitTime, transition: 0x30000008n },
      { url: 'chrome://settings', title: 'x', visit_time: visitTime, transition: 1n },
    ]);
    const close = jest.fn();
    mockOpen.mockImplementation(() => ({ prepare: () => ({ all }), close }));

    const visits = build().fetchNewVisits();

    expect(mockOpen).toHaveBeenCalledWith(path.join(profileDir, 'chrome-history-copy.db'), {
      readOnly: true,
      readBigInts: true,
    });
    expect(typeof all.mock.calls[0][0]).toBe('bigint'); // 比べる時刻も BigInt のまま渡す
    expect(visits).toEqual([
      {
        url: 'https://example.com/a',
        title: '',
        visitTime: new Date('2026-10-29T03:00:00.123Z'),
        transitionType: 8,
      },
    ]);
    expect(close).toHaveBeenCalled();
  });

  it('History DB が無ければ例外を投げること', () => {
    expect(() => build().fetchNewVisits()).toThrow('Chrome History DB が見つかりません');
  });
});
