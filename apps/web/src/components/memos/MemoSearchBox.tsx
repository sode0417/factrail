'use client';

// 🔴 このファイルも client 側で動かすこと（`'use client'` を外さない）。
//    ⭐ 絞り込みは「ブラウザが持っているデータ」に対して行う。サーバ側で絞ると、
//       読書メモの本文が HTML に載って誰にでも配られる（📄 `app/memos/page.tsx` の冒頭参照）。

import {
  Box,
  Flex,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Spinner,
  Text,
} from '@chakra-ui/react';
import { FiAlertTriangle, FiSearch, FiX } from 'react-icons/fi';
import type { MemoSearchGapItem } from '@/lib/memo-search';

/** 探せなかった理由ごとの文面。⛔ ひとまとめの「失敗」にしない。 */
const GAP_LABELS: Record<MemoSearchGapItem['gap'], string> = {
  'not-loaded': '本文をまだ読み込めていません',
  'load-failed': '本文を読み込めませんでした',
  truncated: 'ハイライトが一部しか返っていません',
};

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** 検索語が入っているか（⛔ 空のときに件数や注意書きを出さない） */
  isSearching: boolean;
  /**
   * 本文をこれから取りに行く素材の数。
   * 🔴 これが 0 になるまで「一致 0 件」と言ってはいけない（まだ探し終わっていない）。
   */
  pendingSourceCount: number;
  matchedSourceCount: number;
  matchedMemoCount: number;
  /** 一覧に出ている素材の数（＝今回の検索が見に行った範囲） */
  loadedSourceCount: number;
  /** 🔴 本文・メモを探せなかった素材。空でなければ結果は「全部」ではない */
  unsearched: MemoSearchGapItem[];
  /** ⚠️ 続きの素材が読み込まれていない（＝検索の対象外） */
  hasMore: boolean;
}

/** 注意書きの枠（⭐ 画面の他の「隠さない印」と同じ見た目に合わせる）。 */
function Caution({ testId, children }: { testId: string; children: React.ReactNode }) {
  return (
    <Flex
      align="flex-start"
      gap={2}
      mt={2}
      px={3}
      py={2}
      bg="#FBEFE4"
      border="1px solid"
      borderColor="#E0965A"
      borderRadius="sm"
      data-testid={testId}
    >
      <Icon as={FiAlertTriangle} color="#B4652A" boxSize="14px" mt="2px" flexShrink={0} />
      <Box minW={0} color="#8A4A18" fontSize="11.5px">
        {children}
      </Box>
    </Flex>
  );
}

/**
 * 読書メモの絞り込み欄。
 *
 * ⭐ 入力そのものと、「何をどこまで探したか」の説明だけを持つ。絞り込みの計算は
 *    📄 `lib/memo-search.ts`、データの読み込みは 📄 `app/memos/page.tsx` の側。
 */
export function MemoSearchBox({
  value,
  onChange,
  isSearching,
  pendingSourceCount,
  matchedSourceCount,
  matchedMemoCount,
  loadedSourceCount,
  unsearched,
  hasMore,
}: Props) {
  const stillLoading = isSearching && pendingSourceCount > 0;
  /**
   * ⭐ 「まだ読み込めていない」は上のスピナーの行が言っているので、一覧には出さない。
   *    ⛔ 隠すのではなく、同じことを二重に言わないだけ —— 読み込みが終わると
   *    `load-failed` / `truncated` として残り、必ず名前つきで出る。
   */
  const unsearchedToList = unsearched.filter(({ gap }) => gap !== 'not-loaded');

  return (
    <Box mb={4} data-testid="memos-search">
      <InputGroup maxW="560px">
        <InputLeftElement pointerEvents="none">
          <FiSearch color="#7A7366" />
        </InputLeftElement>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="題名・リンク・本文・メモから探す"
          aria-label="読書メモを探す"
          bg="bg.canvas"
          borderColor="border.muted"
          borderRadius="pill"
          fontSize="13px"
          _hover={{ bg: 'bg.canvas' }}
          _focus={{ bg: 'bg.canvas', borderColor: 'accent.default' }}
          data-testid="memos-search-input"
        />
        {value && (
          <InputRightElement>
            <IconButton
              aria-label="検索語を消す"
              icon={<FiX />}
              size="sm"
              variant="ghost"
              onClick={() => onChange('')}
              data-testid="memos-search-clear"
            />
          </InputRightElement>
        )}
      </InputGroup>

      {/* ⭐ 探す対象を書いておく。⛔ 書かないと「著者で引いて 0 件」を
          「その本が無い」と読まれる（著者・タグは対象外）。 */}
      <Text fontSize="11px" color="text.muted" mt="6px">
        入れた文字が含まれるものを、題名・リンク・ハイライトの本文・自分のメモから探します
        （著者・タグは対象外）。
      </Text>

      {stillLoading && (
        <Flex align="center" gap={2} mt={2} data-testid="memos-search-loading">
          <Spinner size="xs" color="brand.500" />
          {/* 🔴 読み込み中に件数を出さない。「0 件」と読まれる */}
          <Text fontSize="11.5px" color="text.muted">
            本文を読み込んでいます（残り {pendingSourceCount} 件の素材）。まだ探し終わっていません。
          </Text>
        </Flex>
      )}

      {isSearching && !stillLoading && (
        <Text fontSize="11.5px" color="text.muted" mt={2} data-testid="memos-search-summary">
          素材 {matchedSourceCount} 件 / ハイライト {matchedMemoCount} 件が一致
          （読み込めている素材 {loadedSourceCount} 件の中から）
        </Text>
      )}

      {/* 🔴 探せなかった素材を黙って落とさない。落とすと「無い」と言ったことになる */}
      {isSearching && unsearchedToList.length > 0 && (
        <Caution testId="memos-search-unsearched">
          <Text fontWeight={600}>
            {unsearchedToList.length} 件の素材は、本文・メモを探せていません（題名とリンクだけで判定しました）
          </Text>
          <Box as="ul" pl={4} mt="2px">
            {unsearchedToList.map(({ source, gap }) => (
              <li key={source.id}>
                {source.title} — {GAP_LABELS[gap]}
              </li>
            ))}
          </Box>
        </Caution>
      )}

      {/* ⚠️ 未読込のページは検索の対象外。⛔ 黙っていると「全部から探した」と読まれる */}
      {isSearching && hasMore && (
        <Caution testId="memos-search-has-more">
          <Text>
            まだ読み込んでいない素材があります。いま探したのは、この画面に出ている
            {loadedSourceCount} 件の中だけです。下の「もっと読む」で読み込むと対象に入ります。
          </Text>
        </Caution>
      )}
    </Box>
  );
}
