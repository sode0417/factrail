import { f2aClient } from '@/lib/axios';
import type { F2ABook, F2AHighlight, Memo } from '@/types/memo';

/**
 * 読書メモを F2A から取ってきて、画面の形に均す層。
 *
 * 🔴🔴 ここは「F2A の読み出し口が決まったら差し替える 1 ファイル」。
 *
 *   2026-09-27 時点で、F2A に **読み出しの JSON 口は存在しない**。
 *   `/api/books` に生えているのは `POST /import/kindle` の 1 本だけで
 *   （F2A `apps/api/src/routes/books.rs`）、GET は本番のビルドが古いから
 *   404 なのではなく、ソースにも無いから 404 になる。
 *   F2A 側の `/books` は API 自身が HTML を組んで返す画面で、JSON は出さない。
 *
 *   ⇒ 下の `MEMOS_ENDPOINT` と `toMemos()` は **こちらが置いた仮の取り決め**。
 *     F2A の表の列（`20260927_032_books_and_highlights.sql`）に合わせてあるが、
 *     実装されたら実物に合わせて直すこと。画面側（`app/memos/page.tsx` と
 *     `components/memos/`）はこの層より上なので、直すのはここだけで済む。
 */
const MEMOS_ENDPOINT = '/api/books';

/**
 * Kindle の「メモとハイライト」ページ。ASIN から組み立てられる。
 * ⚠️ ASIN が無い本（紙・手入力）にはリンクを作らない。当て推量の URL を出すより、
 *    リンクが無いほうがよい。
 */
function buildSourceUrl(book: F2ABook): string | null {
  if (book.source !== 'kindle' || !book.asin) return null;
  return `https://read.amazon.co.jp/notebook?asin=${encodeURIComponent(book.asin)}`;
}

function toMemo(book: F2ABook, highlight: F2AHighlight): Memo {
  return {
    id: highlight.id,
    text: highlight.text,
    note: highlight.note,
    locator: highlight.locator,
    color: highlight.color,
    maybeTruncated: highlight.maybe_truncated,
    importedAt: highlight.created_at,

    bookId: book.id,
    bookTitle: book.title,
    bookAuthor: book.author,
    bookSource: book.source,
    sourceUrl: buildSourceUrl(book),
    lastHighlightedText: book.last_highlighted_text,
    importNotice: book.import_notice,
  };
}

/**
 * 本をまたいで 1 件ずつに開き、新しい順に並べる。
 *
 * ⚠️ 並べ替えの鍵は取り込み時刻（`created_at`）で、**ハイライトした時刻ではない**。
 *    Kindle 由来には 1 件ごとの日時が存在しない（F2A のマイグレーション参照）。
 *    1 回の取り込みで入った分は時刻がほぼ同じなので、その中の順序は元の並び順のまま
 *    にしてある（sort が安定なのを当てにしている）。
 */
export function toMemos(books: F2ABook[]): Memo[] {
  const memos = books.flatMap((book) =>
    (book.highlights ?? []).map((highlight) => toMemo(book, highlight)),
  );
  return memos.sort(
    (a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime(),
  );
}

/**
 * F2A から読書メモを取得する。
 *
 * 🔴 失敗は握りつぶさず投げる。呼ぶ側で「まだ 1 件も無い」と「読み込めなかった」を
 *    別の表示にするため —— 混ぜると、繋がっていないことに気づけない。
 */
export async function fetchMemos(): Promise<Memo[]> {
  const response = await f2aClient.get<{ data: F2ABook[] }>(MEMOS_ENDPOINT);
  return toMemos(response.data?.data ?? []);
}
