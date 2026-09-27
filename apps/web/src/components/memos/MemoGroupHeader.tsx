'use client';

import { Box, Flex, Icon, Link, Text } from '@chakra-ui/react';
import { FiAlertTriangle, FiExternalLink, FiSlash } from 'react-icons/fi';
import type { MemoGroup } from '@/types/memo';

/**
 * 「取れた分が全部とは限らない」印。
 *
 * 🔴 F2A が `import_notice` を持っている素材には必ず出す。DB に入れただけで画面に
 *    出さないなら、隠したのと同じ。
 * ⚠️ 文面は Amazon の言い分そのままなので、こちらで要約も断定もしない。
 */
function ImportNotice({ notice }: { notice: string }) {
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
    >
      <Icon as={FiAlertTriangle} color="#B4652A" boxSize="14px" mt="2px" flexShrink={0} />
      <Box minW={0}>
        <Text fontSize="12px" fontWeight={600} color="#8A4A18">
          この素材は、取れたハイライトが全部とは限りません
        </Text>
        <Text fontSize="11.5px" color="#8A4A18" whiteSpace="pre-wrap" mt="2px">
          {notice}
        </Text>
      </Box>
    </Flex>
  );
}

/**
 * 元の素材へのリンク。
 *
 * 🔴 本人の指示で **必ず出す**（2026-09-27）。⛔ リンクが作れないときに黙って
 *    消さない —— 「無い」ことが見えないと、取りこぼしに気づけないため。
 * ⭐ 飛び先が判るよう、ラベルにホスト名を出す。
 */
function SourceLink({ url }: { url: string | null }) {
  if (!url) {
    return (
      <Flex align="center" gap="4px" color="text.muted" fontSize="11.5px">
        <Icon as={FiSlash} boxSize="12px" />
        <Text>リンクなし（F2A にこの素材の URL が入っていません）</Text>
      </Flex>
    );
  }

  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    // URL として読めなければ、そのまま出す（握りつぶして無かったことにしない）
  }

  return (
    <Link
      href={url}
      isExternal
      title={url}
      fontSize="11.5px"
      color="accent.strong"
      display="inline-flex"
      alignItems="center"
      gap="4px"
      maxW="100%"
    >
      <Icon as={FiExternalLink} boxSize="12px" flexShrink={0} />
      <Text as="span" noOfLines={1}>
        元の素材へ（{host}）
      </Text>
    </Link>
  );
}

/** 素材 1 つの見出し。この下に、その素材のハイライトが並ぶ。 */
export function MemoGroupHeader({ group }: { group: MemoGroup }) {
  return (
    <Box
      position="sticky"
      top="var(--topbar-h)"
      zIndex={8}
      bg="bg.canvas"
      pt={2}
      pb={2}
      mb={2}
    >
      <Box
        bg="bg.surface"
        border="1px solid"
        borderColor="border.muted"
        borderLeft="4px solid"
        borderLeftColor="accent.default"
        borderRadius="md"
        px={{ base: 4, md: 5 }}
        py={3}
        boxShadow="0 1px 2px rgba(74,60,20,0.04)"
      >
        <Flex align="baseline" gap={3} wrap="wrap">
          <Text
            fontFamily="heading"
            fontWeight={700}
            fontSize="md"
            color="text.default"
            noOfLines={2}
          >
            {group.title}
          </Text>
          {group.author && (
            <Text fontSize="12px" color="text.muted" noOfLines={1}>
              {group.author}
            </Text>
          )}
          <Text fontSize="11.5px" color="text.muted">
            ハイライト {group.memos.length} 件
          </Text>
        </Flex>

        <Flex align="center" gap={3} wrap="wrap" mt="6px">
          <SourceLink url={group.sourceUrl} />
          {/* Amazon の表示そのままの文字列。日付として整形しない */}
          {group.lastHighlightedText && (
            <Text fontSize="11.5px" color="text.muted">
              最後のハイライト: {group.lastHighlightedText}
            </Text>
          )}
        </Flex>

        {group.importNotice && <ImportNotice notice={group.importNotice} />}
      </Box>
    </Box>
  );
}
