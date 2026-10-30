import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { ChromeHistoryService } from './chrome-history.service';

// better-sqlite3 は遅延ロードで、ABI 不一致は new Database() の時点で初めて投げる（#195）
jest.mock('better-sqlite3', () =>
  jest.fn().mockImplementation(() => {
    const error = new Error(
      'The module was compiled against a different Node.js version using NODE_MODULE_VERSION 141.',
    ) as Error & { code: string };
    error.code = 'ERR_DLOPEN_FAILED';
    throw error;
  }),
);

describe('ChromeHistoryService（失敗を握りつぶさない）', () => {
  let profileDir: string;

  beforeEach(() => {
    profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-profile-'));
    // 本番と同じ /tmp/chrome-history-copy.db を触らないよう、コピーと削除は止める
    jest.spyOn(fs, 'copyFileSync').mockImplementation(() => undefined);
    jest.spyOn(fs, 'unlinkSync').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(profileDir, { recursive: true, force: true });
  });

  const build = () =>
    new ChromeHistoryService({
      get: jest.fn().mockReturnValue(profileDir),
    } as unknown as ConfigService);

  it('better-sqlite3 が開けなければ例外を投げること（空配列で握りつぶさない）', () => {
    fs.writeFileSync(path.join(profileDir, 'History'), '');

    expect(() => build().fetchNewVisits()).toThrow('NODE_MODULE_VERSION');
  });

  it('History DB が無ければ例外を投げること', () => {
    expect(() => build().fetchNewVisits()).toThrow('Chrome History DB が見つかりません');
  });
});
