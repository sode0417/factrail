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

/** F2A から受け取る本 1 冊（ハイライトを内側に持つ）。 */
export interface F2ABook {
  id: string;
  title: string;
  /** Kindle 由来は `著者: ` のラベルを含んだまま入っている。画面でラベルを足さない。 */
  author: string | null;
  source: string;
  asin: string | null;
  /** Amazon の表示そのままの文字列。日付として扱わない。 */
  last_highlighted_text: string | null;
  /**
   * Amazon 側が「一部の注釈は表示されていません」と出した文面と、件数表示。
   * 🔴 入っている本は取れたハイライトが全部とは限らない。画面に必ず印を出す。
   */
  import_notice: string | null;
  highlights: F2AHighlight[];
}

/**
 * 画面で使う形。本をまたいで 1 件ずつ並べるので、本の情報を各件に畳み込んである。
 */
export interface Memo {
  id: string;
  text: string;
  note: string | null;
  locator: string | null;
  color: string | null;
  maybeTruncated: boolean;
  /** 並べ替えに使う取り込み時刻。⚠️ ハイライトした時刻ではない。 */
  importedAt: string;

  bookId: string;
  bookTitle: string;
  bookAuthor: string | null;
  bookSource: string;
  /** 元の素材へのリンク。作れないときは null（ASIN の無い紙・手入力）。 */
  sourceUrl: string | null;
  lastHighlightedText: string | null;
  /** 非 null なら「黙って欠けているかもしれない」印を出す。 */
  importNotice: string | null;
}
