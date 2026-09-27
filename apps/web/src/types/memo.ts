/**
 * 読書メモ（素材とハイライト）の型。
 *
 * 🔴 データの持ち主は F2A。factrail は画面だけを持つ。
 *    📏 口の形は F2A の PR #67（`GET /api/media` / `GET /api/media/{id}`）に合わせてある。
 *    ⭐ 2026-09-28 に F2A 担当から提示された実物の仕様。⛔ こちらの推測ではない。
 *
 * ⚠️ 知らないと画面で嘘をつく点:
 *
 *    - `highlighted_at` は Kindle 由来では必ず NULL（Amazon が 1 件ごとの日時を
 *      持っていない）。⛔ 「ハイライトした日時」として出せない。
 *    - `maybe_truncated` の false は「切れていない」ではなく「切れている疑いを
 *      検出しなかった」。⛔ 断定した文言を出さない。
 *    - `last_highlighted_text` は Amazon の表示そのままの文字列
 *      （例: `2026年9月26日土曜日`）。⛔ 日付として解釈しない。
 */

/** 素材 1 つ（一覧で返る形。⛔ ハイライトは持たない）。 */
export interface F2AMedia {
  id: string;
  title: string;
  /** Kindle 由来は `著者: ` のラベルを含んだまま。⛔ 画面でラベルを足さない。 */
  author: string | null;
  /** 何を読んだか: `kindle` / `paper` / `manual` / `web` / `youtube`。 */
  source: string;
  /**
   * どこから取ったか: `kindle-exporter` / `glasp` / `manual`。
   * 🔑 `source` とは別の軸。⛔ 片方だけだと「YouTube の動画を Glasp から取った」が表せない。
   */
  ingest_via: string | null;
  /** 素材そのものの URL。無い素材もある。 */
  source_url: string | null;
  asin: string | null;
  tags: string[] | null;
  summary: string | null;
  last_highlighted_text: string | null;
  /**
   * Amazon 側が「一部の注釈は表示されていません」と出した文面と、件数表示。
   * 🔴 入っている素材は取れたハイライトが全部とは限らない。画面に必ず印を出す。
   */
  import_notice: string | null;
  highlight_count: number;
  /**
   * F2A が並べ替えに使った時刻。
   * 🔑 `MAX(highlighted_at)` → 無ければ `created_at`。Kindle は後者に落ちる。
   * ⛔ これで並べ直さない（F2A は同時刻のとき件数・id まで見て解決している）。
   */
  sort_at: string;
  created_at: string;
  updated_at: string;
}

/** ハイライト 1 件（詳細でのみ返る）。 */
export interface F2AHighlight {
  id: string;
  text: string;
  note: string | null;
  locator: string | null;
  locator_type: string | null;
  color: string | null;
  maybe_truncated: boolean;
  /** ⛔ Kindle 由来では必ず null。 */
  highlighted_at: string | null;
  created_at: string;
}

/** 素材 1 つの詳細。 */
export interface F2AMediaDetail extends F2AMedia {
  highlights: F2AHighlight[];
  /** 🔴 true なら、返っていないハイライトがある。必ず画面に出す。 */
  highlights_truncated: boolean;
}

export interface F2AMediaListResponse {
  data: F2AMedia[];
  meta: {
    /** 🔴 続きの有無はこれで判定する。⛔ `next_cursor` の有無で判定しない。 */
    has_more: boolean;
    next_cursor: string | null;
    limit: number;
  };
}

// =====================
// 画面で使う形
// =====================

/** 素材 1 つ。 */
export interface MemoSource {
  id: string;
  title: string;
  author: string | null;
  source: string;
  ingestVia: string | null;
  sourceUrl: string | null;
  tags: string[];
  lastHighlightedText: string | null;
  importNotice: string | null;
  highlightCount: number;
  /** ⛔ 並べ替えには使わない。「なぜこの順か」の説明用。 */
  sortAt: string;
}

/** ハイライト 1 件。 */
export interface Memo {
  id: string;
  text: string;
  note: string | null;
  locator: string | null;
  color: string | null;
  maybeTruncated: boolean;
}

/** 素材 1 つを開いたときの中身。 */
export interface MemoDetail {
  memos: Memo[];
  /** 🔴 true なら、返っていないハイライトがある。 */
  truncated: boolean;
}

/** 一覧の 1 ページ分。 */
export interface MemoPage {
  items: MemoSource[];
  hasMore: boolean;
  nextCursor: string | null;
  /**
   * ⚠️ カーソルが壊れていた（F2A が 400）ので、先頭から読み直したことを示す。
   * ⛔ 黙って先頭に戻さず、画面に出すために持つ。
   */
  restarted: boolean;
}

// =====================
// 取り込み（kindle-exporter の JSON を F2A へ送る）
// =====================

/**
 * 素材 1 つ分の取り込み結果。
 * 📏 F2A `apps/api/src/books_import.rs` の `BookImportDetail` に対応。
 */
export interface MemoImportDetail {
  title: string;
  asin: string | null;
  /** `created` / `existing` / `skipped` */
  result: string;
  /** 取り込めなかった理由。⭐ 黙って落とさず画面に出す。 */
  skipped_reason: string | null;
  highlights_in_file: number;
  highlights_inserted: number;
  highlights_duplicate: number;
  has_notice: boolean;
}

/**
 * 取り込みの結果。
 *
 * 🔴 **項目名は変わる予定がある**（F2A 担当から連絡あり）:
 *    `books_existing` → `books_updated` + `books_unchanged` など。
 *    ⇒ ⭐ だからすべて **任意** にしてあり、画面は **来た項目だけ出す**。
 *    ⛔ 無い項目で 0 と書くと嘘になる。
 */
export interface MemoImportSummary {
  books_in_file?: number;
  books_created?: number;
  books_existing?: number;
  books_updated?: number;
  books_unchanged?: number;
  books_skipped?: number;
  books_with_notice?: number;
  highlights_in_file?: number;
  highlights_inserted?: number;
  highlights_duplicate?: number;
  highlights_updated?: number;
  highlights_unchanged?: number;
  books?: MemoImportDetail[];
  /**
   * 🔴 F2A が知らなかった JSON の項目名。
   *    ⚠️ 空でないなら、取得側が増やした情報を取り込みが捨てている。必ず画面に出す。
   */
  unknown_fields?: string[];
}

/** 取り込みが失敗した理由。画面の文言を分けるために種類で持つ。 */
export type MemoImportFailure =
  | 'not-deployed'
  | 'unauthorized'
  | 'too-large'
  | 'rejected'
  | 'invalid-json'
  | 'unknown';

export interface MemoImportError {
  kind: MemoImportFailure;
  /** F2A が返した文面があれば添える（無ければ null）。 */
  detail: string | null;
}
