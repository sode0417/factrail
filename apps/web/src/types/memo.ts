/**
 * 読書メモ（ハイライト + 自分のメモ）の型。
 *
 * 🔴 データの持ち主は F2A（`books` / `book_highlights` の 2 表）で、factrail は
 *    画面だけを持つ。ここにあるのは「F2A から受け取る形」と「画面で使う形」の 2 種類。
 *
 * ⚠️ 列の意味は F2A のマイグレーション
 *    `apps/api/migrations/20260927_032_books_and_highlights.sql` が正。
 *    とくに次の 2 点は、知らないと画面で嘘をつく:
 *
 *    - `highlighted_at` は Kindle 由来では必ず NULL（Amazon が 1 件ごとの日時を
 *      持っていない）。だから「ハイライトした日時」は基本的に出せない。本ごとの
 *      `last_highlighted_text` が唯一の手がかりで、これは Amazon の表示そのままの
 *      文字列（例: `2026年9月26日土曜日`）。日付として解釈しない。
 *    - `maybe_truncated` の false は「切れていない」ではなく「切れている疑いを
 *      検出しなかった」。断定した文言を出さない。
 */

/** F2A から受け取るハイライト 1 件（snake_case は F2A 側の表記に合わせる）。 */
export interface F2AHighlight {
  id: string;
  /** ハイライトの本文。 */
  text: string;
  /** 本人が付けたメモ。無いことのほうが多い。 */
  note: string | null;
  /** 位置。Kindle なら位置番号、紙ならページなど。 */
  locator: string | null;
  locator_type: string | null;
  /** Kindle のハイライト色（`yellow` / `pink` など）。未知の色が来てもよい。 */
  color: string | null;
  /** 本文が Amazon 側で切られている疑い。false は「検出しなかった」の意味。 */
  maybe_truncated: boolean;
  /** 取り込んだ時刻。⚠️ ハイライトした時刻ではない。 */
  created_at: string;
}

/**
 * F2A から受け取る素材 1 つ（ハイライトを内側に持つ）。
 *
 * ⭐ 呼び名について: 表の名前は `books` だが、本人は web / YouTube も同じ仕組みに
 *    入れるつもりでおられる（2026-09-27 シート 58ddd654 の設問 3 の補足）。
 *    画面では「本」と決めつけず **素材** と呼ぶ。
 */
export interface F2ABook {
  id: string;
  title: string;
  /** Kindle 由来は `著者: ` のラベルを含んだまま入っている。画面でラベルを足さない。 */
  author: string | null;
  /** 📏 2026-09-27 時点の F2A は `kindle` / `paper` / `manual` の 3 つだけ。 */
  source: string;
  asin: string | null;
  /**
   * 素材そのものの URL。
   * 🔴 2026-09-27 時点の F2A には **この列が無い**。本人が web / YouTube のリンクも
   *    欲しいと言われているので、足された瞬間に流れるよう受け口だけ先に開けてある。
   *    ⛔ 来ないことを前提に、必ず null を許す。
   */
  url?: string | null;
  /** Amazon の表示そのままの文字列。日付として扱わない。 */
  last_highlighted_text: string | null;
  /**
   * Amazon 側が「一部の注釈は表示されていません」と出した文面と、件数表示。
   * 🔴 入っている素材は取れたハイライトが全部とは限らない。画面に必ず印を出す。
   */
  import_notice: string | null;
  highlights: F2AHighlight[];
}

/** 画面で使うハイライト 1 件。素材の情報は外側の {@link MemoGroup} が持つ。 */
export interface Memo {
  id: string;
  text: string;
  note: string | null;
  locator: string | null;
  color: string | null;
  maybeTruncated: boolean;
  /** 並べ替えに使う取り込み時刻。⚠️ ハイライトした時刻ではない。 */
  importedAt: string;
}

/**
 * 素材 1 つと、その中のハイライト。
 *
 * 📌 一覧は **素材ごとにまとめて**出す（2026-09-27 シート 58ddd654 の設問 2 で本人が
 *    「本ごとにまとめる」を選択）。⛔ 本をまたいで 1 列に混ぜない。
 */
export interface MemoGroup {
  id: string;
  title: string;
  author: string | null;
  source: string;
  /** 元の素材へのリンク。作れないときは null。画面は null のときもその旨を出す。 */
  sourceUrl: string | null;
  lastHighlightedText: string | null;
  /** 非 null なら「黙って欠けているかもしれない」印を出す。 */
  importNotice: string | null;
  memos: Memo[];
  /** 素材どうしの並べ替えに使う、この素材でいちばん新しい取り込み時刻。 */
  latestImportedAt: string;
}
