'use client';

import { Box, Flex, HStack, Icon, Link, Text } from '@chakra-ui/react';
import { FiAlertTriangle, FiExternalLink } from 'react-icons/fi';
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
 * 「取れた分が全部とは限らない」印。
 *
 * 🔴 F2A が `import_notice` を持っている本には必ず出す。DB に入れただけで画面に
 *    出さないなら、隠したのと同じ。
 * ⚠️ 文面は Amazon の言い分そのままなので、こちらで要約も断定もしない。
 */
function ImportNotice({ notice }: { notice: string }) {
  return (
    <Flex
      align="flex-start"
      gap={2}
      mt={3}
      px={3}
      py={2}
      bg="#FBEFE4"
      border="1px solid"
      borderColor="#E0965A"
      borderRadius="sm"
    >
      <Icon as={FiAlertTriangle} color="#B4652A" boxSize="14px" mt="2px" flexShrink={0} />
      <Box minW={0}>
        <Text fontSize="12px" fontWeight={600} color="#8A4A18">
          この本は、取れたハイライトが全部とは限りません
        </Text>
        <Text fontSize="11.5px" color="#8A4A18" whiteSpace="pre-wrap" mt="2px">
          {notice}
        </Text>
      </Box>
    </Flex>
  );
}

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

      {/* ハイライトの本文 */}
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

      {memo.importNotice && <ImportNotice notice={memo.importNotice} />}

      {/* 出どころ */}
      <Flex align="baseline" gap={3} wrap="wrap" mt={3}>
        <Text fontWeight={600} fontSize="sm" color="text.default" noOfLines={1}>
          {memo.bookTitle}
        </Text>
        {memo.bookAuthor && (
          <Text fontSize="12px" color="text.muted" noOfLines={1}>
            {memo.bookAuthor}
          </Text>
        )}
      </Flex>

      <HStack spacing={2} mt={2} wrap="wrap">
        {memo.color && <Chip>{memo.color}</Chip>}
        {memo.locator && <Chip>{memo.locator}</Chip>}
        {/* Amazon の表示そのままの文字列。日付として整形しない */}
        {memo.lastHighlightedText && (
          <Text fontSize="11.5px" color="text.muted">
            最後のハイライト: {memo.lastHighlightedText}
          </Text>
        )}
        {memo.sourceUrl && (
          <Link
            href={memo.sourceUrl}
            isExternal
            fontSize="11.5px"
            color="accent.strong"
            display="inline-flex"
            alignItems="center"
            gap="4px"
          >
            元の素材へ
            <Icon as={FiExternalLink} boxSize="12px" />
          </Link>
        )}
      </HStack>
    </Box>
  );
}
