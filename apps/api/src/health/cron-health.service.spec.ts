import { CronHealthService } from './cron-health.service';

describe('CronHealthService', () => {
  const HOUR = 60 * 60 * 1000;
  let service: CronHealthService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-27T00:00:00Z'));
    service = new CronHealthService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const after = (ms: number) => new Date(Date.now() + ms);

  it('起動直後で一度も成功していなければ pending を返すこと（デプロイ直後の誤検知を避ける）', () => {
    service.register('job', { staleAfterMs: 2 * HOUR, enabled: true });

    expect(service.getStatuses(after(1 * HOUR)).job.status).toBe('pending');
  });

  it('起動から閾値を超えて一度も実行されていなければ stale を返すこと', () => {
    service.register('job', { staleAfterMs: 2 * HOUR, enabled: true });

    expect(service.getStatuses(after(2 * HOUR + 1)).job.status).toBe('stale');
  });

  it('起動後に成功が無く失敗だけなら、閾値を待たずに stale を返すこと（再起動で数え直しになっても見逃さない）', () => {
    service.register('job', { staleAfterMs: 26 * HOUR, enabled: true });
    service.recordFailure('job');

    const status = service.getStatuses(after(1)).job;
    expect(status.status).toBe('stale');
    expect(status.consecutiveFailures).toBe(1);
  });

  it('一度でも成功していれば、その後の失敗は閾値までは healthy のままであること', () => {
    service.register('job', { staleAfterMs: 2 * HOUR, enabled: true });
    service.recordSuccess('job');
    service.recordFailure('job');

    expect(service.getStatuses(after(1 * HOUR)).job.status).toBe('healthy');
  });

  it('閾値以内に成功していれば healthy を返すこと', () => {
    service.register('job', { staleAfterMs: 2 * HOUR, enabled: true });
    jest.setSystemTime(after(5 * HOUR));
    service.recordSuccess('job');

    const status = service.getStatuses(after(1 * HOUR)).job;
    expect(status.status).toBe('healthy');
    expect(status.lastSuccessAt).toBe(new Date().toISOString());
  });

  it('最後の成功から閾値を超えたら stale を返すこと', () => {
    service.register('job', { staleAfterMs: 2 * HOUR, enabled: true });
    service.recordSuccess('job');

    expect(service.getStatuses(after(2 * HOUR + 1)).job.status).toBe('stale');
  });

  it('成功すると連続失敗回数が 0 に戻ること', () => {
    service.register('job', { staleAfterMs: 2 * HOUR, enabled: true });
    service.recordFailure('job');
    service.recordFailure('job');
    expect(service.getStatuses().job.consecutiveFailures).toBe(2);

    service.recordSuccess('job');
    expect(service.getStatuses().job.consecutiveFailures).toBe(0);
  });

  it('無効化されたジョブは時間が経っても disabled のままであること', () => {
    service.register('job', { staleAfterMs: 2 * HOUR, enabled: false });

    expect(service.getStatuses(after(100 * HOUR)).job.status).toBe('disabled');
  });

  it('未登録のジョブの記録は無視され、例外にならないこと', () => {
    expect(() => service.recordSuccess('unknown')).not.toThrow();
    expect(() => service.recordFailure('unknown')).not.toThrow();
    expect(service.getStatuses()).toEqual({});
  });

  it('閾値を分単位でも返すこと', () => {
    service.register('job', { staleAfterMs: 26 * HOUR, enabled: true });

    expect(service.getStatuses().job.staleAfterMinutes).toBe(26 * 60);
  });
});
