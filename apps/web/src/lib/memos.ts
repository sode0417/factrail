import { f2aClient } from '@/lib/axios';
import type { F2ABook, F2AHighlight, Memo, MemoGroup } from '@/types/memo';

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
 *   ⇒ 下の `MEMOS_ENDPOINT` と変換は **こちらが置いた仮の取り決め**。
 *     F2A の表の列（`20260927_032_books_and_highlights.sql`）に合わせてあるが、
 *     実装されたら実物に合わせて直すこと。画面側（`app/memos/page.tsx` と
 *     `components/memos/`）はこの層より上なので、直すのはここだけで済む。
 */
const MEMOS_ENDPOINT = '/api/books';

/**
 * 素材へのリンクを決める。
 *
 * 🔴 本人は「web や YouTube の場合はそのリンクも」と言われている
 *    （2026-09-27 シート 58ddd654 設問 3 の補足）。⛔ ただし F2A の `books` 表には
 *    **URL の列がまだ無く**、`source` も `kindle` / `paper` / `manual` の 3 つしか
 *    取れない。⇒ ⭐ F2A が `url` を持ったらそれを最優先で使い、それまでは
 *    Kindle の ASIN からだけ組み立てる。
 *
 * ⚠️ 作れないときは null を返し、画面側で「リンクがありません」と出す。
 *    ⛔ 黙って何も出さない（＝リンクが無いことに気づけない）のを避けるため。
 */
function resolveSourceUrl(book: F2ABook): string | null {
  // F2A が素材そのものの URL を持っていれば、それが正
  if (book.url && book.url.trim()) return book.url.trim();

  // Kindle は ASIN から「メモとハイライト」のページを組み立てられる
  if (book.source === 'kindle' && book.asin) {
    return `https://read.amazon.co.jp/notebook?asin=${encodeURIComponent(book.asin)}`;
  }

  return null;
}

function toMemo(highlight: F2AHighlight): Memo {
  return {
    id: highlight.id,
    text: highlight.text,
    note: highlight.note,
    locator: highlight.locator,
    color: highlight.color,
    maybeTruncated: highlight.maybe_truncated,
    importedAt: highlight.created_at,
  };
}

/** 空文字や未定義が混ざっても NaN にならないよう、読めない時刻は 0 に倒す。 */
function toTime(value: string): number {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * 素材ごとにまとめる。
 *
 * 📌 本人が「本ごとにまとめる」を選ばれた（2026-09-27 シート 58ddd654 設問 2）。
 *
 * ⚠️ 素材どうしの並びは、その素材でいちばん新しい取り込み時刻の降順。
 *    **ハイライトした時刻ではない** —— Kindle 由来には 1 件ごとの日時が存在しない。
 * ⭐ 素材の中の並びは **受け取った順のまま** にしてある。1 回の取り込みで入った分は
 *    時刻がほぼ同じで並べ替えても意味が無く、取得側が渡してくる順（＝読んだ順）の
 *    ほうが読み物として自然なため。⛔ ここで時刻ソートし直さない。
 */
export function toMemoGroups(books: F2ABook[]): MemoGroup[] {
  const groups = books.map((book) => {
    const memos = (book.highlights ?? []).map(toMemo);
    const latestImportedAt = memos.reduce<string>(
      (latest, memo) => (toTime(memo.importedAt) > toTime(latest) ? memo.importedAt : latest),
      memos[0]?.importedAt ?? '',
    );

    return {
      id: book.id,
      title: book.title,
      author: book.author,
      source: book.source,
      sourceUrl: resolveSourceUrl(book),
      lastHighlightedText: book.last_highlighted_text,
      importNotice: book.import_notice,
      memos,
      latestImportedAt,
    };
  });

  return groups.sort((a, b) => toTime(b.latestImportedAt) - toTime(a.latestImportedAt));
}

/**
 * F2A から読書メモを取得する。
 *
 * 🔴 失敗は握りつぶさず投げる。呼ぶ側で「まだ 1 件も無い」と「読み込めなかった」を
 *    別の表示にするため —— 混ぜると、繋がっていないことに気づけない。
 */
export async function fetchMemoGroups(): Promise<MemoGroup[]> {
  const response = await f2aClient.get<{ data: F2ABook[] }>(MEMOS_ENDPOINT);
  return toMemoGroups(response.data?.data ?? []);
}
