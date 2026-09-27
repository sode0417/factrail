'use client';

import { Flex, Text } from '@chakra-ui/react';
import type { MemoMatch } from '@/lib/memo-search';

/**
 * 素材 1 つが「なぜ検索に出ているか」の一行。
 *
 * 🔴 **当たり方を隠さない。** 題名だけが当たった素材と、本文が当たった素材を
 *    同じ見た目で並べると、読み手は「本文に書いてある」と誤読する。
 * ⭐ 一致したハイライトだけを出しているときは、隠している件数も書く
 *    （⛔ 「この素材にはこれしか無い」と読まれないため）。
 */
export function MemoMatchNote({ match }: { match: MemoMatch }) {
  const matched = match.matchedMemos.length;
  const where = [match.titleMatch ? '題名' : null, match.linkMatch ? 'リンク' : null]
    .filter(Boolean)
    .join('と');

  return (
    <Flex align="center" gap={2} px={4} py="6px" data-testid="memo-match-note">
      <Text fontSize="11.5px" color="text.muted">
        {matched > 0
          ? `ハイライト ${match.searchedMemoCount} 件のうち ${matched} 件が一致${
              where ? `（${where}も一致）` : ''
            } — 一致した分だけ出しています`
          : `${where || '題名'}が一致（本文・メモの一致は 0 件）`}
      </Text>
    </Flex>
  );
}
