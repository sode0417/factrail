# #195 ネイティブモジュールの ABI 不一致を検知する（cron の鮮度を /health に出す）

> GitHub Issue: https://github.com/sode0417/factrail/issues/195
> ブランチ: `feat/195-cron-freshness-health`
> ステータス: レビュー中

## 要件 (Issue から展開)

better-sqlite3 の ABI 不一致で `ChromeHistoryService` が 7 日間失敗し続けたが、誰も気づかなかった。
核心は ABI そのものではなく、**cron が例外を握って logger.error するだけで、失敗が誰にも届かない**こと。
`/health` は 200 / `ok` のままで、launchd・deploy.sh のヘルスチェックもすり抜けた。

判断メモ（2026-08-11・Issue コメント）で決まったこと:

1. `deploy.json` の `health_expect_jq` を `.status != "unhealthy"` に緩める（実装では `status` キーが無い応答を通さないよう `.status == "ok" or .status == "degraded"` と書いた。`!= "unhealthy"` より厳しく、未知の値も通さない）。あわせて `unhealthy` レベルを定義する（定義しないと常に真になり、ゲートが無くなる）
2. 対象は cron 3 本すべて（browser / slack / backup）
3. 案 A（起動時 ABI 検査）・案 B（deploy.sh での ABI 突合）は見送る。ABI 不一致の再発を観測したら着手する
4. テストは補助案の分だけ書く

## 受入条件

- [x] cron が閾値を超えて成功していないとき、`/health` が `degraded` を返す（単体テスト）
- [x] ABI 不一致の例外が握りつぶされず、cron の失敗として記録される（`ERR_DLOPEN_FAILED` を投げるモックで再現）
- [x] 正常時・デプロイ直後・無効化中は誤検知しない（`pending` / `disabled` は `ok` 扱い）
- [x] DB 断は `unhealthy`、deploy.sh はそれだけを失敗とみなす
- [x] `pnpm rebuild` が効かない件を踏まえた復旧手順を `.claude/quickref.md` に記載
- [ ] Mac mini で ABI 不一致を意図的に作って実測する — **本番 API が動いている機械を壊すため、実施前に本人の確認を取る**（判断メモ 4-3）。未実施

## スコープ外

- 案 A・案 B（判断メモ 3。記述は Issue に残す）
- N 回連続失敗での通知（Slack DM 等）。外へ送る経路が増えるので別途判断。連続失敗回数は `/health` の `consecutiveFailures` で見える
- ウォーターマーク（`/tmp/browser-collector-last-run.json`）を永続領域へ移すこと。今回は「見つからないときに黙って 1 時間へ落とさず警告ログを出す」までにした

- `scheduled-backup` は件数を数えてログに出すだけで、実際の退避先への保存はしていない（既存の動作）。今回の鮮度チェックで分かるのは「この cron が動いて DB に問い合わせられたか」まで。本当のバックアップの仕組みは別の課題
- browser のウォーターマークは LLM の要約・保存より前に進む（既存の動作）。LLM が全滅した回は失敗として記録されるが、その回の訪問は取り直されない。次の回で 1 件でも保存できれば `healthy` に戻るので、欠けた分は `/health` には残らない
- `lastSuccessAt` の永続化（DB・ファイル）。メモリのみなので、cron 自体が一度も動かない状態で毎日再起動されると `pending` のまま見逃す（失敗が 1 回でも記録されれば即 `stale` になるので、ABI 不一致のような「動くが失敗する」型は捕まる）

## 設計サマリー

Fact の最終 `occurredAt` ではなく、**各 cron が自分の成功・失敗を `CronHealthService` に報告**し、最後の成功からの経過時間で鮮度を判定する。

- Fact 基準にしなかった理由: slack は DM が無い日は Fact が増えない（正常）。backup は Fact を作らない。どちらも誤検知か判定不能になる
- 記録はメモリのみ。再起動で消えるので、成功が無い間は**プロセス起動時刻**を起点に閾値を数える。閾値以内は `pending`（デプロイ直後に `degraded` にしないため）
- ただし起動後に**成功が無く失敗だけ**がある場合は、閾値を待たずに `stale` にする。デプロイが 1 日 1 回以上あると日次の cron は閾値 26 時間に届かず、失敗し続けても見逃すため（レビュー指摘）。browser はデプロイ直後の 1 回の一時的な失敗でも次の成功まで `degraded` になるが、`degraded` はデプロイを止めないので許容する
- 手動トリガー（`POST /browser-collector/trigger` など）の成功も成功として数える
- 閾値は cron ごと: browser（毎時）2 時間 15 分 / slack（毎日）26 時間 / backup（毎日）26 時間
- 無効化中は `disabled`: browser は `BROWSER_COLLECTOR_ENABLED !== 'true'`、slack は `SLACK_BOT_TOKEN_WORK` か `SLACK_USER_ID_WORK` が未設定。backup は常に有効
- `ChromeHistoryService.fetchNewVisits()` は読取失敗（DB を開けない・History が無い）で空配列を返していたのを、例外を投げるように変えた。「新しい訪問が無い」と区別するため
- browser はセッションが 1 件も保存できなかったとき（LLM・DB 全滅）も失敗扱い
- `/health` のレスポンスには時刻と回数だけを出し、エラー文は出さない（機密を含めないため）

| status      | 条件                               | deploy.sh |
| ----------- | ---------------------------------- | --------- |
| `ok`        | DB 正常・stale な cron なし        | 通す      |
| `degraded`  | DB 正常・stale な cron が 1 本以上 | 通す      |
| `unhealthy` | DB に繋がらない                    | 失敗      |

## 影響範囲

| エリア     | ファイル / モジュール                                  | 変更概要                                                                |
| ---------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| API        | `health/cron-health.{service,module}.ts`               | 新規。cron の成功・失敗の記録と鮮度判定                                 |
| API        | `health/health.controller.ts`                          | `unhealthy` を追加、`crons` を返す                                      |
| API        | `browser-collector/*`・`slack-collector/*`・`backup/*` | 成功・失敗を報告。Chrome 読取失敗を握らない・ウォーターマーク欠落の警告 |
| CI / Infra | `deploy.json`                                          | ゲートを `.status != "unhealthy"` に                                    |
| Docs       | `.claude/quickref.md`                                  | degraded の見方・ABI 不一致の復旧手順                                   |

## 関連リンク

- テスト計画: [test-plan.md](./test-plan.md)
