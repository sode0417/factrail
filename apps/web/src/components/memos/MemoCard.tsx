'use client';

import { Box, HStack, Text } from '@chakra-ui/react';
import type { Memo } from '@/types/memo';

/**
 * Kindle のハイライト色を、画面の色に読み替える。
 *
 * ⚠️ 未知の色が来ても壊れないこと（F2A 側は色の語を解釈せずそのまま持っている）。
 *    知らない色は既定の色で出し、名前はそのまま添える。
 */
const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: '#E8C547',
  pink: '#D98BA8',
  blue: '#6A9BC3',
  orange: '#E0965A',
};

function highlightColor(color: string | null): string {
  if (!color) return 'accent.default';
  return HIGHLIGHT_COLORS[color.toLowerCase()] ?? 'accent.default';
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <Box
      as="span"
      display="inline-block"
      bg="bg.surface-2"
      color="#2A2A2A"
      fontSize="11.5px"
      fontWeight={500}
      px="10px"
      py="3px"
      borderRadius="sm"
      lineHeight="1.3"
    >
      {children}
    </Box>
  );
}

/**
 * ハイライト 1 件。
 * ⭐ 素材の題名・リンク・欠落の印は、外側の {@link MemoGroupHeader} が持つ。
 */
export function MemoCard({ memo }: { memo: Memo }) {
  return (
    <Box
      position="relative"
      bg="bg.surface"
      border="1px solid"
      borderColor="border.muted"
      borderRadius="md"
      px={{ base: 4, md: 6 }}
      py={4}
      boxShadow="0 1px 2px rgba(74,60,20,0.04)"
      transition="transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease"
      _hover={{
        transform: 'translateY(-2px)',
        boxShadow: '0 2px 6px rgba(74,60,20,0.08), 0 14px 30px rgba(74,60,20,0.17)',
        borderColor: 'accent.soft',
      }}
      overflow="hidden"
    >
      {/* 左の帯。ハイライトの色をそのまま出す（色だけに意味を持たせないよう、
          色の名前は下のチップにも出している） */}
      <Box
        position="absolute"
        left={0}
        top={3}
        bottom={3}
        w="3px"
        bg={highlightColor(memo.color)}
        borderRadius="full"
      />

      <Text
        fontSize="md"
        color="text.default"
        whiteSpace="pre-wrap"
        lineHeight="1.8"
        data-testid="memo-text"
      >
        {memo.text}
      </Text>

      {memo.maybeTruncated && (
        <Text fontSize="11.5px" color="#B4652A" mt={1}>
          ⚠️ 本文が途中で切れている疑いがあります（切れていないと確かめたわけではありません）
        </Text>
      )}

      {/* 自分のメモ */}
      {memo.note && (
        <Box
          mt={3}
          px={3}
          py={2}
          bg="accent.soft"
          borderLeft="3px solid"
          borderColor="accent.default"
          borderRadius="sm"
        >
          <Text fontSize="11px" color="accent.strong" fontWeight={600} mb="2px">
            メモ
          </Text>
          <Text fontSize="sm" color="text.default" whiteSpace="pre-wrap">
            {memo.note}
          </Text>
        </Box>
      )}

      {(memo.color || memo.locator) && (
        <HStack spacing={2} mt={3} wrap="wrap">
          {memo.color && <Chip>{memo.color}</Chip>}
          {memo.locator && <Chip>{memo.locator}</Chip>}
        </HStack>
      )}
    </Box>
  );
}
