#!/usr/bin/env bash
# 汎用デプロイスクリプト（launchd 管理版）
# deploy.json を読み取り、ビルド → launchctl kickstart → ヘルスチェックを行う。
#
# 使い方:
#   ./scripts/deploy.sh                        # 全サービス
#   ./scripts/deploy.sh web                    # 指定サービスのみ
#   DEPLOY_SKIP_PULL=1 ./scripts/deploy.sh web # git pull を省略（ローカルリハーサル用）
#
# 前提:
#   - deploy.json がリポジトリルートにあり、各サービスに launchd_label がある
#   - 対象サービスが gui/$(id -u) ドメインに LaunchAgent としてロード済み
#   - jq / curl / lsof / pgrep / launchctl が使える
#
# 設計メモ:
#   - プロセスの停止・起動は一切行わない。launchd に kickstart を要求するだけ。
#     これにより launchd の PGID 管理（AbandonProcessGroup=false）が効き、
#     GitHub Actions runner の "Cleaning up orphan processes" の対象外になる。
#     旧実装は lsof + kill + nohup でプロセスを直接起動していたため、
#     ジョブ終了時に runner に殺され、起動成功判定が false positive になっていた。
#   - 全処理を main() に閉じ込めてあるのは、実行中に git pull が本ファイルを
#     差し替えても影響を受けないようにするため（bash はスクリプトを遅延読みする）。
#   - bash 3.2 (macOS 標準) で動作すること。連想配列・mapfile は使えない。

set -euo pipefail

REPO_ROOT="${DEPLOY_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
DEPLOY_CONFIG="$REPO_ROOT/deploy.json"
TARGET_SERVICE="${1:-}"

GUI_DOMAIN="gui/$(id -u)"
SPAWN_TIMEOUT="${DEPLOY_SPAWN_TIMEOUT:-30}"   # kickstart → 新 PID 出現まで（ExitTimeOut 5 + ThrottleInterval 10 + 余裕）
HEALTH_TIMEOUT="${DEPLOY_HEALTH_TIMEOUT:-90}" # kickstart → 健全判定まで
POLL_INTERVAL=1                               # api の ThrottlerModule(short: 3req/1000ms) を踏まないため 1 秒固定
MAX_RESPAWN=3                                 # ヘルス待ち中に許容する再起動回数（超えたらクラッシュループ）

FAILED_SERVICES=""

ts()   { date '+%H:%M:%S'; }
log()  { echo "[deploy] $(ts) $*"; }
warn() { echo "[deploy] $(ts) WARN:  $*" >&2; }
err()  { echo "[deploy] $(ts) ERROR: $*" >&2; }

# ---------------------------------------------------------------- launchd ヘルパ

# launchctl print の "<field> = <value>" を 1 件取り出す（1 語のフィールドのみ）。
# state は job / domain 等で複数回現れるため、最初の 1 件（= job のもの）を採る。
launchd_field() {
  local label="$1" field="$2"
  launchctl print "$GUI_DOMAIN/$label" 2>/dev/null \
    | awk -v f="$field" '$1 == f && $2 == "=" { print $3; exit }' \
    || true
}

# サービスが gui ドメインに存在し print できるか。
# 成功: rc=0 / 失敗: launchctl の生エラーメッセージを stdout に返し rc!=0
launchd_probe() {
  local label="$1"
  # stdout（print の本文）は捨て、stderr のエラーメッセージだけを呼び出し元へ返す
  { launchctl print "$GUI_DOMAIN/$label" >/dev/null; } 2>&1
}

# 失敗時の診断ダンプ
dump_launchd_diag() {
  local name="$1" label="$2" error_log="$3"
  err "[$name] --- launchctl print $GUI_DOMAIN/$label ---"
  launchctl print "$GUI_DOMAIN/$label" 2>&1 \
    | grep -E '^[[:space:]]+(state|pid|runs|last exit code|program|working directory) =' >&2 || true
  if [[ -n "$error_log" ]]; then
    error_log="${error_log/#\~/$HOME}"
    if [[ -f "$error_log" ]]; then
      err "[$name] --- $error_log 末尾 30 行 ---"
      tail -n 30 "$error_log" >&2 || true
    fi
  fi
}

# ------------------------------------------------------------ プロセス系統ヘルパ

# 指定 PID の子孫（自身を含む）を空白区切りで出力する。
# web は launchd 直下が `npm exec next start` で、実際に LISTEN するのはその子の
# `next-server` なので、PID 一致判定ではなく子孫判定が必要。
descendant_pids() {
  local queue="$1" out="" pid children guard=0
  while [[ -n "$queue" ]]; do
    guard=$((guard + 1))
    if [[ "$guard" -gt 200 ]]; then break; fi
    pid="${queue%% *}"
    case "$queue" in
      *" "*) queue="${queue#* }" ;;
      *)     queue="" ;;
    esac
    if [[ -z "$pid" ]]; then continue; fi
    out="$out $pid"
    children=$(pgrep -P "$pid" 2>/dev/null | tr '\n' ' ' || true)
    if [[ -n "${children// /}" ]]; then
      queue="$queue $children"
    fi
    queue=$(printf '%s' "$queue" | tr -s ' ' | sed -e 's/^ //' -e 's/ $//')
  done
  printf '%s' "$out" | tr -s ' ' | sed -e 's/^ //' -e 's/ $//'
}

pid_in_list() {
  local needle="$1" p
  shift
  for p in "$@"; do
    if [[ "$p" == "$needle" ]]; then return 0; fi
  done
  return 1
}

# ------------------------------------------------------------------- 再起動・検証
# restart_service <name> <label> <port> <health_path> <expect_jq> <timeout> <error_log>
restart_service() {
  local name="$1" label="$2" port="$3" health_path="$4" expect_jq="$5" timeout="$6" error_log="$7"
  local target="$GUI_DOMAIN/$label"
  local runs_before pid_before ks_out ks_rc
  local waited=0 elapsed=0 job_pid="" state="" last_reason=""
  local runs_now respawns listen_pids desc stray p resp code body budget

  runs_before=$(launchd_field "$label" runs); runs_before="${runs_before:-0}"
  pid_before=$(launchd_field "$label" pid);   pid_before="${pid_before:-}"

  log "[$name] 再起動: launchctl kickstart -kp $target  (再起動前 runs=$runs_before pid=${pid_before:-none})"

  ks_rc=0
  ks_out=$(launchctl kickstart -kp "$target" 2>&1) || ks_rc=$?
  if [[ "$ks_rc" -ne 0 ]]; then
    err "[$name] kickstart 失敗 (rc=$ks_rc): $ks_out"
    dump_launchd_diag "$name" "$label" "$error_log"
    return 1
  fi
  if [[ -n "$ks_out" ]]; then log "[$name] kickstart 出力: $ks_out"; fi

  # --- 段 A: 新しいジョブ PID が現れるまで待つ ---
  while [[ "$waited" -lt "$SPAWN_TIMEOUT" ]]; do
    state=$(launchd_field "$label" state)
    job_pid=$(launchd_field "$label" pid)
    if [[ "$state" == "running" && -n "$job_pid" && "$job_pid" != "$pid_before" ]]; then
      break
    fi
    job_pid=""
    sleep "$POLL_INTERVAL"; waited=$((waited + POLL_INTERVAL))
  done
  if [[ -z "$job_pid" ]]; then
    err "[$name] ${SPAWN_TIMEOUT}s 以内に新プロセスが起動しませんでした (state=${state:-unknown})"
    err "[$name] ThrottleInterval=10 のため最大 10s 遅延しますが、それを超えています"
    dump_launchd_diag "$name" "$label" "$error_log"
    return 1
  fi
  log "[$name] launchd PID=$job_pid で spawn 確認 (${waited}s)"

  # --- 段 B/C/D: クラッシュループ / 系統 / HTTP ---
  budget=$((timeout - waited))
  if [[ "$budget" -lt 10 ]]; then budget=10; fi

  while [[ "$elapsed" -lt "$budget" ]]; do
    # 段 B: クラッシュループ検出
    runs_now=$(launchd_field "$label" runs); runs_now="${runs_now:-$runs_before}"
    respawns=$((runs_now - runs_before - 1))
    if [[ "$respawns" -ge "$MAX_RESPAWN" ]]; then
      err "[$name] クラッシュループ検出: kickstart 後に ${respawns} 回再起動 (runs ${runs_before} → ${runs_now})"
      dump_launchd_diag "$name" "$label" "$error_log"
      return 1
    fi

    job_pid=$(launchd_field "$label" pid)
    if [[ -z "$job_pid" ]]; then
      last_reason="プロセス未起動（ThrottleInterval 待ちの可能性）"
      sleep "$POLL_INTERVAL"; elapsed=$((elapsed + POLL_INTERVAL)); continue
    fi

    listen_pids=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | tr '\n' ' ' || true)
    if [[ -z "${listen_pids// /}" ]]; then
      last_reason="ポート $port が LISTEN されていない"
      sleep "$POLL_INTERVAL"; elapsed=$((elapsed + POLL_INTERVAL)); continue
    fi

    # 段 C: 系統チェック（LISTEN 中の PID はすべて launchd ジョブの子孫であること）
    # 孤児がポートを握っている場合、curl は孤児が応答して 200 を返すため、
    # HTTP 判定だけでは false positive を除去できない。ここが本体。
    desc=$(descendant_pids "$job_pid")
    stray=""
    for p in $listen_pids; do
      if ! pid_in_list "$p" $desc; then stray="$stray $p"; fi
    done
    if [[ -n "$stray" ]]; then
      err "[$name] ポート $port を launchd 管理外のプロセスが占有しています: PID$stray"
      err "[$name] launchd ジョブ $label の PID=$job_pid / 子孫=[$desc]"
      err "[$name] 旧 nohup デプロイが残した孤児の可能性が高い。確認してください:"
      err "[$name]   ps -o pid,ppid,pgid,lstart,command -p$(printf '%s' "$stray" | tr ' ' ',' | sed 's/^,//')"
      dump_launchd_diag "$name" "$label" "$error_log"
      return 1
    fi

    # 段 D: HTTP（1 ポーリング 1 リクエスト。ThrottlerModule short=3req/1s に対し 1req/s）
    resp=$(curl -s -m 5 -w '\n%{http_code}' "http://localhost:${port}${health_path}" 2>/dev/null || true)
    code="${resp##*$'\n'}"; code="${code:-000}"
    body="${resp%$'\n'*}"

    case "$code" in
      2*)
        if [[ -z "$expect_jq" ]]; then
          log "[$name] 起動成功: PID=$job_pid port=$port HTTP=$code  (kickstart から $((waited + elapsed))s)"
          return 0
        fi
        if printf '%s' "$body" | jq -e "$expect_jq" >/dev/null 2>&1; then
          log "[$name] 起動成功: PID=$job_pid port=$port HTTP=$code  (kickstart から $((waited + elapsed))s)"
          return 0
        fi
        # /health は DB 断でも HTTP 200 を返し body だけ "degraded" になる
        last_reason="HTTP $code だが期待条件 '$expect_jq' を満たさない: $(printf '%s' "$body" | head -c 200)"
        ;;
      429)
        last_reason="HTTP 429 (ThrottlerModule) — バックオフして再試行"
        sleep 2; elapsed=$((elapsed + 2))
        ;;
      000)
        last_reason="接続できない（起動途中の可能性）"
        ;;
      *)
        last_reason="HTTP $code"
        ;;
    esac
    sleep "$POLL_INTERVAL"; elapsed=$((elapsed + POLL_INTERVAL))
  done

  err "[$name] ${timeout}s 以内に健全になりませんでした: ${last_reason:-理由不明}"
  dump_launchd_diag "$name" "$label" "$error_log"
  return 1
}

# ------------------------------------------------------------------ マイグレーション
apply_migrations() {
  local idx="$1" migrations_dir="$2"
  local full_path="$REPO_ROOT/$migrations_dir"
  local db_url="" env_file="" cand configured applied=0 sql_file filename exists

  if [[ ! -d "$full_path" ]]; then
    log "マイグレーションディレクトリなし: $migrations_dir"
    return 0
  fi

  configured=$(jq -r ".services[$idx].env_file // empty" "$DEPLOY_CONFIG")

  # 旧実装は「最初に存在したファイル」で break していたため、0 バイトの
  # $REPO_ROOT/.env に当たって apps/api/.env に到達できなかった。
  # → DATABASE_URL が取れたときだけ break する。
  for cand in ${configured:+"$REPO_ROOT/$configured"} \
              "$REPO_ROOT/apps/api/.env" \
              "$REPO_ROOT/backend/.env" \
              "$REPO_ROOT/.env"; do
    if [[ ! -f "$cand" ]]; then continue; fi
    db_url=$(grep -E '^DATABASE_URL=' "$cand" 2>/dev/null | head -1 | cut -d= -f2- \
             | sed -e 's/^"//' -e "s/^'//" -e 's/"$//' -e "s/'$//")
    if [[ -n "$db_url" ]]; then env_file="$cand"; break; fi
  done

  if [[ -z "$db_url" ]]; then
    err "DATABASE_URL が見つかりません（探索: ${configured:+$configured, }apps/api/.env, backend/.env, .env）"
    return 1
  fi
  log "DATABASE_URL を $env_file から読み込み"

  psql "$db_url" -c "
    CREATE TABLE IF NOT EXISTS migration_history (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  " &>/dev/null

  for sql_file in "$full_path"/*.sql; do
    if [[ ! -f "$sql_file" ]]; then continue; fi
    filename=$(basename "$sql_file")

    exists=$(psql "$db_url" -tAc "SELECT 1 FROM migration_history WHERE filename = '$filename';" 2>/dev/null || echo "")
    if [[ "$exists" == "1" ]]; then continue; fi

    log "マイグレーション適用: $filename"
    if psql "$db_url" -f "$sql_file" &>/dev/null; then
      psql "$db_url" -c "INSERT INTO migration_history (filename) VALUES ('$filename');" &>/dev/null
      applied=$((applied + 1))
    else
      err "マイグレーション失敗: $filename"
      return 1
    fi
  done

  if [[ $applied -gt 0 ]]; then
    log "マイグレーション $applied 件適用完了"
  else
    log "新規マイグレーションなし"
  fi
  return 0
}

# ------------------------------------------------------------------ サービス単位
deploy_service() {
  local i="$1"
  local name type dir port build_cmd label health_path expect_jq timeout error_log migrations_dir

  name=$(jq -r ".services[$i].name" "$DEPLOY_CONFIG")
  type=$(jq -r ".services[$i].type" "$DEPLOY_CONFIG")
  dir=$(jq -r ".services[$i].dir" "$DEPLOY_CONFIG")
  port=$(jq -r ".services[$i].port" "$DEPLOY_CONFIG")
  build_cmd=$(jq -r ".services[$i].build_cmd // empty" "$DEPLOY_CONFIG")
  label=$(jq -r ".services[$i].launchd_label // empty" "$DEPLOY_CONFIG")
  health_path=$(jq -r ".services[$i].health_path // \"/\"" "$DEPLOY_CONFIG")
  expect_jq=$(jq -r ".services[$i].health_expect_jq // empty" "$DEPLOY_CONFIG")
  timeout=$(jq -r ".services[$i].health_timeout // empty" "$DEPLOY_CONFIG"); timeout="${timeout:-$HEALTH_TIMEOUT}"
  error_log=$(jq -r ".services[$i].error_log // empty" "$DEPLOY_CONFIG")
  migrations_dir=$(jq -r ".services[$i].migrations_dir // empty" "$DEPLOY_CONFIG")

  # 旧実装は未対応タイプを err だけ出して成功扱いにしていた。ここで必ず失敗させる。
  case "$type" in
    node|nextjs|rust) : ;;
    *) err "[$name] 未対応のタイプ: $type"; return 1 ;;
  esac

  if [[ -z "$label" ]]; then
    err "[$name] deploy.json に launchd_label がありません"
    return 1
  fi

  if [[ -n "$migrations_dir" ]]; then
    if ! apply_migrations "$i" "$migrations_dir"; then
      err "[$name] マイグレーション失敗"
      return 1
    fi
  fi

  if [[ -n "$build_cmd" ]]; then
    log "[$name] ビルド開始: ($dir) $build_cmd"
    if ! (cd "$REPO_ROOT/$dir" && eval "$build_cmd"); then
      err "[$name] ビルド失敗（サービスは旧バージョンのまま稼働継続）"
      return 1
    fi
    log "[$name] ビルド完了"
  fi

  restart_service "$name" "$label" "$port" "$health_path" "$expect_jq" "$timeout" "$error_log"
}

# ------------------------------------------------------------------ プリフライト
# git pull もビルドも再起動も行う前に、launchctl が使えるかだけを read-only で確かめる。
# ここで落ちた場合、リポジトリもサービスも一切変更されていない＝ダウンタイム 0。
preflight() {
  local count i name label msg bad=0
  count=$(jq '.services | length' "$DEPLOY_CONFIG")
  # 変数展開の直後に全角文字が来ると bash が変数名の一部と解釈するため ${} で明示的に閉じる
  log "launchd プリフライト（ドメイン: ${GUI_DOMAIN}）"
  for i in $(seq 0 $((count - 1))); do
    name=$(jq -r ".services[$i].name" "$DEPLOY_CONFIG")
    if [[ -n "$TARGET_SERVICE" && "$name" != "$TARGET_SERVICE" ]]; then continue; fi

    label=$(jq -r ".services[$i].launchd_label // empty" "$DEPLOY_CONFIG")
    if [[ -z "$label" ]]; then
      err "  NG  [$name] launchd_label が deploy.json にありません"
      bad=1; continue
    fi

    if msg=$(launchd_probe "$label"); then
      log "  OK  $label"
      continue
    fi

    err "  NG  $label: ${msg:-（メッセージなし）}"
    # 注: "Bad request." はサービス未登録でもドメイン到達不能でも出るため、
    #     より具体的な "Could not find service" を先に判定する。
    case "$msg" in
      *"Could not find service"*)
        err "      → LaunchAgent が未ロード、またはラベル名が誤っています:"
        err "         launchctl list | grep ${label}"
        err "         launchctl bootstrap ${GUI_DOMAIN} ~/Library/LaunchAgents/${label}.plist"
        ;;
      *"Could not find domain"*|*"Bootstrap failed"*|*"Input/output error"*|*"Operation not permitted"*)
        err "      → ${GUI_DOMAIN} ドメイン自体に到達できません。"
        err "      → runner plist の SessionCreate=true が原因の可能性が高いです。"
        err "      → 対処: ~/Library/LaunchAgents/actions.runner.sode0417-factrail.mac-mini-factrail.plist"
        err "              の SessionCreate を false にして runner を再ロードしてください。"
        ;;
      *)
        err "      → 想定外のエラーです。上のメッセージを確認してください。"
        ;;
    esac
    bad=1
  done
  if [[ "$bad" -ne 0 ]]; then return 1; fi
  return 0
}

# ------------------------------------------------------------------------ main
main() {
  local c service_count i name matched=0

  if [[ ! -f "$DEPLOY_CONFIG" ]]; then err "deploy.json が見つかりません: $DEPLOY_CONFIG"; exit 1; fi
  for c in jq curl lsof pgrep launchctl; do
    if ! command -v "$c" >/dev/null 2>&1; then err "$c が必要です"; exit 1; fi
  done

  log "デプロイ開始: $(basename "$REPO_ROOT")${TARGET_SERVICE:+ (target: $TARGET_SERVICE)}"

  # 0) launchd プリフライト（何も変更しないうちに検査する）
  if ! preflight; then
    err "launchd プリフライトに失敗。リポジトリもサービスも変更していません（サービスは旧バージョンで稼働継続）。"
    exit 1
  fi

  # 1) git pull
  if [[ "${DEPLOY_SKIP_PULL:-0}" == "1" ]]; then
    log "DEPLOY_SKIP_PULL=1 のため git pull をスキップ"
  else
    log "最新コードを取得"
    if ! (cd "$REPO_ROOT" && git pull origin main --ff-only); then err "git pull 失敗"; exit 1; fi
  fi
  log "HEAD: $(cd "$REPO_ROOT" && git log -1 --pretty='%h %s')"

  # 2) 依存
  log "依存パッケージをインストール"
  if ! (cd "$REPO_ROOT" && pnpm install --frozen-lockfile); then err "pnpm install 失敗"; exit 1; fi

  # 3) サービスループ（1 つ失敗しても後続を続ける）
  service_count=$(jq '.services | length' "$DEPLOY_CONFIG")
  for i in $(seq 0 $((service_count - 1))); do
    name=$(jq -r ".services[$i].name" "$DEPLOY_CONFIG")
    if [[ -n "$TARGET_SERVICE" && "$name" != "$TARGET_SERVICE" ]]; then continue; fi
    matched=1
    if ! deploy_service "$i"; then
      FAILED_SERVICES="$FAILED_SERVICES $name"
    fi
  done

  if [[ -n "$TARGET_SERVICE" && "$matched" -eq 0 ]]; then
    err "deploy.json にサービス '$TARGET_SERVICE' がありません"
    exit 1
  fi

  if [[ -n "$FAILED_SERVICES" ]]; then
    err "デプロイ失敗:$FAILED_SERVICES"
    exit 1
  fi
  log "デプロイ完了"
}

# 実行中に git pull が本ファイルを差し替えてもパース済みで影響を受けないよう、
# 全処理を main() に閉じ込めて最終行で呼ぶ。
main "$@"
