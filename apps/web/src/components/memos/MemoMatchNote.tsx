'use client';

import { Flex, Text } from '@chakra-ui/react';
import type { MemoMatch, MemoSearchGap } from '@/lib/memo-search';

/**
 * 本文・メモを探せていない理由ごとの言い方。
 *
 * 🔴 **探せていない素材に「一致は 0 件」と書かない。** 0 件だったのではなく見ていない。
 *    📏 2026-09-28 の `claude-review` の指摘で直した（題名だけが当たった素材で、
 *    詳細が未取得・失敗・一部だけのときに「本文・メモの一致は 0 件」と断定していた）。
 */
const GAP_TEXT: Record<MemoSearchGap, string> = {
  'not-loaded': '本文・メモはまだ読み込めていないので探せていません',
  'load-failed': '本文・メモを読み込めなかったので探せていません',
  truncated: '出ている分の本文・メモに一致は無く、返っていない分は探せていません',
};

interface Props {
  match: MemoMatch;
  /** 🔴 本文・メモを探せていない理由。無ければ null（＝ちゃんと探した） */
  gap: MemoSearchGap | null;
}

/**
 * 素材 1 つが「なぜ検索に出ているか」の一行。
 *
 * 🔴 **当たり方を隠さない。** 題名だけが当たった素材と、本文が当たった素材を
 *    同じ見た目で並べると、読み手は「本文に書いてある」と誤読する。
 * ⭐ 一致したハイライトだけを出しているときは、隠している件数も書く
 *    （⛔ 「この素材にはこれしか無い」と読まれないため）。
 */
export function MemoMatchNote({ match, gap }: Props) {
  const matched = match.matchedMemos.length;
  const where = [match.titleMatch ? '題名' : null, match.linkMatch ? 'リンク' : null]
    .filter(Boolean)
    .join('と');

  let body: string;
  if (matched > 0) {
    body =
      `ハイライト ${match.searchedMemoCount} 件のうち ${matched} 件が一致` +
      (where ? `（${where}も一致）` : '') +
      ' — 一致した分だけ出しています' +
      // ⚠️ 一部しか返っていないなら、出ている分の中での件数でしかない
      (gap === 'truncated' ? '（返っていないハイライトは探せていません）' : '');
  } else if (gap) {
    // 🔴 ここで「0 件」と言わない
    body = `${where || '題名'}が一致（${GAP_TEXT[gap]}）`;
  } else {
    body = `${where || '題名'}が一致（本文・メモの一致は 0 件）`;
  }

  return (
    <Flex align="center" gap={2} px={4} py="6px" data-testid="memo-match-note">
      <Text fontSize="11.5px" color="text.muted">
        {body}
      </Text>
    </Flex>
  );
}
