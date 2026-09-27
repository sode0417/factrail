import { f2aClient } from '@/lib/axios';
import type {
  F2AHighlight,
  F2AMedia,
  F2AMediaDetail,
  F2AMediaListResponse,
  Memo,
  MemoDetail,
  MemoImportError,
  MemoImportFailure,
  MemoImportSummary,
  MemoPage,
  MemoSource,
} from '@/types/memo';

/**
 * 読書メモを F2A から取ってきて、画面の形に均す層。
 *
 * 📏 口の形は F2A の PR #67 に合わせてある（2026-09-28 に F2A 担当から提示された実物）。
 *    ⛔ 以前のようにこちらで推測した形ではない。
 *
 * 📏 **2026-09-28 05:5x に本番へ入った**（`GET https://f2a-api.sode-ai.com/api/media` が
 *    クッキー無しで **401** を返す＝口は生きている。404 ではない）。
 *    ⚠️ それより前の版では 404 が返っていた。画面はどちらも「読み込めませんでした」
 *    として出す（⛔ 「まだありません」と混ぜない）。
 *
 * 🔴 **検索の口は無い。** 絞り込みはブラウザの中で行う（📄 `lib/memo-search.ts`）。
 *    ⛔ ここに `?q=` を足さない —— F2A 側に足すには f2a-api の再ビルドが要り、
 *       実行中のバイナリを置き換えると本番が落ちる（📏 2026-09-27 23:32 / 09-28 00:50 に実際に発生）。
 */
const MEDIA_ENDPOINT = '/api/media';

/** 一覧の 1 ページの件数。⛔ F2A 側の既定（50）に合わせてある。 */
const PAGE_LIMIT = 50;

function toMemoSource(media: F2AMedia): MemoSource {
  return {
    id: media.id,
    title: media.title,
    author: media.author,
    source: media.source,
    ingestVia: media.ingest_via,
    sourceUrl: media.source_url,
    tags: media.tags ?? [],
    lastHighlightedText: media.last_highlighted_text,
    importNotice: media.import_notice,
    highlightCount: media.highlight_count,
    sortAt: media.sort_at,
  };
}

function toMemo(highlight: F2AHighlight): Memo {
  return {
    id: highlight.id,
    text: highlight.text,
    note: highlight.note,
    locator: highlight.locator,
    color: highlight.color,
    maybeTruncated: highlight.maybe_truncated,
  };
}

function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

async function requestPage(cursor?: string): Promise<F2AMediaListResponse> {
  const params = new URLSearchParams({ limit: String(PAGE_LIMIT) });
  if (cursor) params.set('cursor', cursor);
  const response = await f2aClient.get<F2AMediaListResponse>(
    `${MEDIA_ENDPOINT}?${params.toString()}`,
  );
  return response.data;
}

/**
 * 素材の一覧を 1 ページ取る。
 *
 * 🔴 **並べ替えをしない。** F2A が返した順のまま描く。
 *    ⚠️ F2A 側は `MAX(highlighted_at)` → 無ければ `created_at` → 同着ならハイライトの多い順
 *    → `id` という鍵で並べている。⛔ こちらで並べ直すと、その配慮が消える。
 *    📏 実際 F2A 担当は「1回の取り込みは1トランザクションなので全冊が同時刻になり、
 *    ハイライト0件の素材が上位を占めた」という穴を踏んで直している。同じ穴に入らない。
 *
 * ⚠️ カーソルが壊れていると F2A は **400** を返す（⛔ 黙って先頭に戻したりしない）。
 *    その場合はカーソルを捨てて先頭から読み直し、`restarted: true` で呼び元に伝える
 *    —— ⛔ 黙って読み直すと、利用者には「勝手に一番上に戻った」としか見えない。
 */
export async function fetchMemoPage(cursor?: string): Promise<MemoPage> {
  let payload: F2AMediaListResponse;
  let restarted = false;

  try {
    payload = await requestPage(cursor);
  } catch (error) {
    if (cursor && statusOf(error) === 400) {
      payload = await requestPage();
      restarted = true;
    } else {
      throw error;
    }
  }

  return {
    items: (payload?.data ?? []).map(toMemoSource),
    // 🔴 続きの有無は has_more で判定する。⛔ next_cursor の有無で判定しない
    hasMore: payload?.meta?.has_more === true,
    nextCursor: payload?.meta?.next_cursor ?? null,
    restarted,
  };
}

/**
 * 素材 1 つのハイライトを取る。
 *
 * ⭐ 一覧は件数しか持たないので、開いたときにここで取る。
 *    ⛔ 一覧の描画時にまとめて取らない（素材の数だけ叩くことになるため）。
 */
export async function fetchMemoDetail(mediaId: string): Promise<MemoDetail> {
  const response = await f2aClient.get<{ data: F2AMediaDetail }>(
    `${MEDIA_ENDPOINT}/${encodeURIComponent(mediaId)}`,
  );
  const detail = response.data?.data;
  return {
    memos: (detail?.highlights ?? []).map(toMemo),
    // 🔴 返っていないハイライトがあることを、黙って隠さない
    truncated: detail?.highlights_truncated === true,
  };
}

// =====================
// 取り込み
// =====================

/**
 * 取り込みの口。
 * 📏 F2A `apps/api/src/routes/books.rs` の `POST /api/books/import/kindle`。
 * ⚠️ F2A 側のボディ上限は 16MB（`MAX_IMPORT_BYTES`）。
 */
const IMPORT_ENDPOINT = '/api/books/import/kindle';

/** F2A 側の上限に合わせる。超えたら送らずに手前で止める（413 だけでは理由が判らない）。 */
const MAX_IMPORT_BYTES = 16 * 1024 * 1024;

/** axios のエラーから HTTP ステータスと本文を取り出す（型を絞るだけ）。 */
function readAxiosError(error: unknown): { status?: number; detail: string | null } {
  const res = (error as { response?: { status?: number; data?: unknown } })?.response;
  if (!res) return { detail: null };

  let detail: string | null = null;
  const data = res.data;
  if (typeof data === 'string' && data.trim()) detail = data.trim();
  else if (data && typeof data === 'object') {
    const msg = (data as { error?: unknown; message?: unknown }).error
      ?? (data as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) detail = msg.trim();
  }
  return { status: res.status, detail };
}

/**
 * kindle-exporter が出した JSON を F2A へ送る。
 *
 * 🔴 失敗の理由を種類で返す。⛔ ひとまとめの「失敗しました」にしない ——
 *    とくに **404（F2A に口がまだ無い）** を他と混ぜると、こちらの作りの誤りだと
 *    誤解される。
 *
 * ⭐ 取り込みは冪等（📏 F2A 担当の実測: 同じファイルの2回目は `inserted: 0`）。
 */
export async function importKindleMemos(file: File): Promise<MemoImportSummary> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw { kind: 'too-large', detail: null } satisfies MemoImportError;
  }

  // 送る前に JSON として読めるか確かめる。⭐ 読めないものを送っても 400 が返るだけで、
  //    「ファイルを間違えた」のか「口が違う」のかが画面から判らなくなる。
  const raw = await file.text();
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw { kind: 'invalid-json', detail: null } satisfies MemoImportError;
  }

  try {
    const response = await f2aClient.post<{ data: MemoImportSummary }>(
      IMPORT_ENDPOINT,
      payload,
    );
    return response.data?.data ?? {};
  } catch (error) {
    const { status, detail } = readAxiosError(error);
    const kind: MemoImportFailure =
      status === 404 ? 'not-deployed'
      : status === 401 || status === 403 ? 'unauthorized'
      : status === 413 ? 'too-large'
      : status === 400 || status === 422 ? 'rejected'
      : 'unknown';
    throw { kind, detail } satisfies MemoImportError;
  }
}
