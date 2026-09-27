import type { Memo, MemoDetail, MemoSource } from '@/types/memo';

/**
 * 読書メモの絞り込み。
 *
 * 🔴 **探す対象は 4 つだけ**（📏 本人の回答 2026-09-27 22:07「本文・自分のメモ・本の題名すべて」
 *    ＋ 自由記述「web や youtube の場合はそのリンクなども取得してほしい」）:
 *      1. ハイライトの本文（`text`）
 *      2. 自分で付けたメモ（`note`）
 *      3. 題名（`title`）
 *      4. 素材のリンク（`sourceUrl`）
 *    ⛔ 著者・タグ・位置は対象外。⭐ 対象外であることは画面に書く —— 書かないと
 *       「著者で引いて 0 件」を「その本が無い」と読まれる。
 *
 * 🔴 **絞り込みはブラウザの中だけで行う。** F2A の `/api/media` に検索の口は無く、
 *    足すには f2a-api の再ビルドが要る（⛔ 実行中のバイナリの差し替えは本番を落とす）。
 *    📏 2026-09-28 時点の実データは素材 5 件・ハイライト 29 件なので画面側で足りる。
 *    ⚠️ 素材が増えると「一覧の全素材の詳細を取ってから絞り込む」形が重くなる。
 *       その時は F2A 側に検索を足して置き換えること。
 *
 * 🔴 **「一致しなかった」と「そもそも探せていない」を混ぜない。**
 *    詳細（ハイライト）を取れていない素材は、本文・メモを見ていない。
 *    ⛔ それを黙って「一致 0 件」に含めると、あるものを無いと言うことになる。
 *    ⇒ {@link MemoSearchResult.unsearched} に分けて返し、画面が必ず出す。
 */

/** 本文・メモを探せなかった理由。⛔ ひとまとめの「失敗」にしない。 */
export type MemoSearchGap =
  /** 詳細をまだ取りに行けていない（読み込み中） */
  | 'not-loaded'
  /** 取りに行って失敗した */
  | 'load-failed'
  /** 一部しか返っていない（F2A の `highlights_truncated`） */
  | 'truncated';

/** 探せなかった素材 1 つ。 */
export interface MemoSearchGapItem {
  source: MemoSource;
  gap: MemoSearchGap;
}

/** 一致した素材 1 つ。 */
export interface MemoMatch {
  source: MemoSource;
  /** 題名が一致した */
  titleMatch: boolean;
  /** リンクが一致した */
  linkMatch: boolean;
  /**
   * 本文またはメモが一致したハイライト。
   * ⛔ 空でも素材が出ることはある（題名・リンクだけが一致した場合）。
   */
  matchedMemos: Memo[];
  /** その素材で実際に見に行けたハイライトの件数（⛔ `highlightCount` とは別物） */
  searchedMemoCount: number;
}

export interface MemoSearchResult {
  /**
   * 一致した素材。
   * 🔴 並びは渡された順のまま。⛔ 一致件数で並べ替えない ——
   *    F2A が `MAX(highlighted_at)` → `created_at` → 件数 → `id` で解決した並びを壊さない。
   */
  matches: MemoMatch[];
  /** 一致したハイライトの総数 */
  matchedMemoCount: number;
  /**
   * 🔴 本文・メモを探せていない素材（題名とリンクだけで判定した）。
   *    ⛔ 空でないなら、この検索の結果は「全部」ではない。画面に必ず出す。
   */
  unsearched: MemoSearchGapItem[];
}

/**
 * 突き合わせ用に文字を均す。
 *
 * ⭐ NFKC で全角・半角の差を消す（`ＡＩ` と `AI`、`ｶﻣ` と `カナ`）。
 *    ⚠️ 日本語には大文字小文字が無いので `toLowerCase` は英数字にだけ効く。
 * ⛔ ひらがな・カタカナの相互変換や送り仮名の揺れまでは見ない（過剰に当たるため）。
 */
export function normalizeForSearch(value: string): string {
  return value.normalize('NFKC').toLowerCase();
}

/** 均した上で部分一致するか。空の針は「当たらない」（⛔ 全件一致にしない）。 */
function includesQuery(haystack: string | null | undefined, needle: string): boolean {
  if (!haystack || !needle) return false;
  return normalizeForSearch(haystack).includes(needle);
}

export interface MemoSearchInput {
  /** 一覧で読み込めている素材。⚠️ 続きが未読込なら、それは検索の対象外 */
  sources: MemoSource[];
  /** 読み込めている詳細。⛔ 無い素材は「一致しなかった」ではなく「探せていない」 */
  detailMap: Record<string, MemoDetail>;
  /** 詳細の取得に失敗した素材の id */
  failedIds: Set<string>;
  /** 検索語（前後の空白は呼び元で落としてもここで落としてもよい） */
  query: string;
}

/**
 * 素材 1 つが、本文・メモを探せる状態かどうか。
 * ⭐ ハイライトが 0 件の素材は、取りに行かなくても探し終わっている（探す中身が無い）。
 */
function gapOf(
  source: MemoSource,
  detail: MemoDetail | undefined,
  failed: boolean,
): MemoSearchGap | null {
  if (failed) return 'load-failed';
  if (!detail) return source.highlightCount > 0 ? 'not-loaded' : null;
  // 🔴 一部しか返っていないなら、出ていない本文は探せていない
  if (detail.truncated) return 'truncated';
  return null;
}

/**
 * 素材とハイライトを検索語で絞り込む。
 *
 * ⭐ 検索語が空なら {@link MemoSearchResult.matches} は全素材（絞り込まない）。
 *    その場合 `unsearched` も出さない —— 絞り込んでいないので「探せなかった」も無い。
 */
export function searchMemos(input: MemoSearchInput): MemoSearchResult {
  const { sources, detailMap, failedIds } = input;
  const needle = normalizeForSearch(input.query.trim());

  if (!needle) {
    return {
      matches: sources.map((source) => ({
        source,
        titleMatch: false,
        linkMatch: false,
        matchedMemos: [],
        searchedMemoCount: detailMap[source.id]?.memos.length ?? 0,
      })),
      matchedMemoCount: 0,
      unsearched: [],
    };
  }

  const matches: MemoMatch[] = [];
  const unsearched: MemoSearchGapItem[] = [];
  let matchedMemoCount = 0;

  for (const source of sources) {
    const detail = detailMap[source.id];
    const gap = gapOf(source, detail, failedIds.has(source.id));
    // 🔴 一致したかどうかに関わらず、探せていない素材は必ず数え上げる
    if (gap) unsearched.push({ source, gap });

    const titleMatch = includesQuery(source.title, needle);
    const linkMatch = includesQuery(source.sourceUrl, needle);
    const memos = detail?.memos ?? [];
    const matchedMemos = memos.filter(
      (memo) => includesQuery(memo.text, needle) || includesQuery(memo.note, needle),
    );

    if (!titleMatch && !linkMatch && matchedMemos.length === 0) continue;

    matchedMemoCount += matchedMemos.length;
    matches.push({
      source,
      titleMatch,
      linkMatch,
      matchedMemos,
      searchedMemoCount: memos.length,
    });
  }

  return { matches, matchedMemoCount, unsearched };
}
