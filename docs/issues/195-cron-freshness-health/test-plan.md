# #195 テスト計画

## 自動テスト

| #   | 対象                                | 内容                                                                                                  | 結果                                        |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| T1  | `cron-health.service.spec.ts`       | pending / healthy / stale / disabled の判定、起動後に失敗だけなら即 stale、連続失敗回数、未登録ジョブ | PASS                                        |
| T2  | `health.controller.spec.ts`         | DB 断 → unhealthy、stale → degraded、pending・disabled → ok、unhealthy 優先                           | PASS                                        |
| T3  | `browser-collector.service.spec.ts` | `ERR_DLOPEN_FAILED` で失敗記録、訪問なしは成功、全セッション保存失敗は失敗、無効時は記録なし          | PASS                                        |
| T4  | `chrome-history.service.spec.ts`    | `new Database()` が投げたら例外を伝える、History が無ければ例外                                       | PASS                                        |
| T5  | `backup.service.spec.ts`            | 成功・失敗の記録、常に有効で登録                                                                      | PASS                                        |
| T5b | `slack-collector.service.spec.ts`   | トークン有無での有効・無効、0 件でも成功、team_id・チャンネル・ユーザー欠落と例外で失敗               | PASS                                        |
| T6  | `test/health.e2e-spec.ts`           | status が 3 値のいずれか、`crons` に 3 本                                                             | CI で確認（手元に factrail_test DB が無い） |

`apps/api` で `npx jest`: 30 suites / 323 tests PASS。`tsc --noEmit`・ESLint・Prettier PASS（2026-10-27）。

## デプロイ後に確かめること

- [ ] `curl -s http://localhost:3001/health | jq '.status, .crons'` で 3 本が出て、`status` が `ok`
- [ ] 次の毎時 0 分のあと `browser-collector` が `healthy`、`lastSuccessAt` が入る
- [ ] deploy.sh のヘルスチェックが新しいゲートで通る

## 本人の確認が要るもの

- [ ] Mac mini で ABI 不一致を意図的に作り、2 時間 15 分後に `degraded` になることを実測（本番を壊すので独断でやらない）
