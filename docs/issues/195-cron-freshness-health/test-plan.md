# #195 テスト計画

## 自動テスト

| #   | 対象                                | 内容                                                                                                                                                                                                                                                                                                                                                                                         | 結果                                        |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| T1  | `cron-health.service.spec.ts`       | pending / healthy / stale / disabled の判定、起動後に失敗だけなら即 stale、連続失敗回数、未登録ジョブ                                                                                                                                                                                                                                                                                        | PASS                                        |
| T2  | `health.controller.spec.ts`         | DB 断 → unhealthy、stale → degraded、pending・disabled → ok、unhealthy 優先                                                                                                                                                                                                                                                                                                                  | PASS                                        |
| T3  | `browser-collector.service.spec.ts` | `ERR_DLOPEN_FAILED` で失敗記録、訪問なしは成功、全セッション保存失敗は失敗、無効時は記録なし                                                                                                                                                                                                                                                                                                 | PASS                                        |
| T4  | `chrome-history.service.spec.ts`    | `DatabaseSync` が投げたら例外を伝える（#245 で better-sqlite3 から node:sqlite に替えた後）、History が無ければ例外                                                                                                                                                                                                                                                                          | PASS                                        |
| T5  | `backup.service.spec.ts`            | 成功・失敗の記録、常に有効で登録                                                                                                                                                                                                                                                                                                                                                             | PASS                                        |
| T5b | `slack-collector.service.spec.ts`   | トークン有無での有効・無効、0 件でも成功、team_id・チャンネル・ユーザー欠落と例外で失敗                                                                                                                                                                                                                                                                                                      | PASS                                        |
| T6  | `test/health.e2e-spec.ts`           | status が 3 値のいずれか、`crons` に 3 本                                                                                                                                                                                                                                                                                                                                                    | CI で確認（手元に factrail_test DB が無い） |
| T7  | `cron-health.integration.spec.ts`   | 本物の読取・収集・鮮度の記録・`/health` をつなぎ、node:sqlite の読み込みが例外を投げる形にする → cron は落ちず 1 回目で `degraded`、失敗の理由が読み込みの例外であること、DB は healthy、エラー文は出さない、連続失敗が数えられる。対照として、表だけある本物の History を読めるときは `healthy`。読み込みの差し替えを効かなくすると落ちること、`recordFailure` を外すと落ちることも確かめた | PASS（2026-11-17）                          |

`apps/api` で `npx jest`: 30 suites / 323 tests PASS。`tsc --noEmit`・ESLint・Prettier PASS（2026-10-27）。
T7 を足した後: 32 suites / 332 tests PASS、`tsc --noEmit`・ESLint・Prettier PASS（2026-11-17）。

## デプロイ後に確かめること

- [x] `curl -s http://localhost:3001/health | jq '.status, .crons'` で 3 本が出て、`status` が `ok`（2026-11-17 09:10 JST に確認。3 本とも healthy、連続失敗 0）
- [x] 次の毎時 0 分のあと `browser-collector` が `healthy`、`lastSuccessAt` が入る（#241 のデプロイ 2026-10-30 の後。2026-11-17 09:00 JST の回で確認）
- [x] deploy.sh のヘルスチェックが新しいゲートで通る（#241 の後の Deploy は #245・#246・#258 などすべて success。2026-11-17 に gh run list で確認）

## 本人の確認が要るもの

- [ ] Mac mini で ABI 不一致を意図的に作り、`degraded` になることを実測（起動後に失敗だけなら閾値を待たず 1 回目で `stale`）（本番を壊すので独断でやらない）
