'use client';

import { Box, Flex, Icon, Link, Text } from '@chakra-ui/react';
import {
  FiAlertTriangle,
  FiChevronDown,
  FiChevronRight,
  FiExternalLink,
  FiSlash,
} from 'react-icons/fi';
import type { MemoSource } from '@/types/memo';

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
      data-testid="memo-import-notice"
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
      onClick={(e) => e.stopPropagation()}
    >
      <Icon as={FiExternalLink} boxSize="12px" flexShrink={0} />
      <Text as="span" noOfLines={1}>
        元の素材へ（{host}）
      </Text>
    </Link>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <Box
      as="span"
      display="inline-block"
      bg="bg.surface-2"
      color="#2A2A2A"
      fontSize="11px"
      fontWeight={500}
      px="8px"
      py="2px"
      borderRadius="sm"
      lineHeight="1.4"
    >
      {children}
    </Box>
  );
}

/** 何を読んだか（`source`）の呼び名。⛔ 知らない値が来てもそのまま出す。 */
const SOURCE_LABELS: Record<string, string> = {
  kindle: 'Kindle',
  paper: '紙',
  manual: '手入力',
  web: 'Web',
  youtube: 'YouTube',
};

/** どこから取ったか（`ingest_via`）の呼び名。🔑 `source` とは別の軸。 */
const INGEST_LABELS: Record<string, string> = {
  'kindle-exporter': 'kindle-exporter で取得',
  glasp: 'Glasp で取得',
  manual: '手入力',
};

interface Props {
  source: MemoSource;
  isExpanded: boolean;
  onToggle: () => void;
}

/** 素材 1 つの見出し。クリックでハイライトを開く。 */
export function MemoSourceHeader({ source, isExpanded, onToggle }: Props) {
  return (
    <Box
      as="button"
      type="button"
      onClick={onToggle}
      aria-expanded={isExpanded}
      textAlign="left"
      w="100%"
      bg="bg.surface"
      border="1px solid"
      borderColor="border.muted"
      borderLeft="4px solid"
      borderLeftColor="accent.default"
      borderRadius="md"
      px={{ base: 4, md: 5 }}
      py={3}
      boxShadow="0 1px 2px rgba(74,60,20,0.04)"
      transition="border-color 0.15s ease, box-shadow 0.15s ease"
      _hover={{ borderColor: 'accent.soft', boxShadow: '0 2px 6px rgba(74,60,20,0.08)' }}
      data-testid="memo-source"
    >
      <Flex align="baseline" gap={3} wrap="wrap">
        <Icon
          as={isExpanded ? FiChevronDown : FiChevronRight}
          boxSize="16px"
          color="text.muted"
          alignSelf="center"
          flexShrink={0}
        />
        <Text
          fontFamily="heading"
          fontWeight={700}
          fontSize="md"
          color="text.default"
          noOfLines={2}
        >
          {source.title}
        </Text>
        {source.author && (
          <Text fontSize="12px" color="text.muted" noOfLines={1}>
            {source.author}
          </Text>
        )}
        <Text fontSize="11.5px" color="text.muted">
          ハイライト {source.highlightCount} 件
        </Text>
      </Flex>

      <Flex align="center" gap={3} wrap="wrap" mt="6px" pl="28px">
        <SourceLink url={source.sourceUrl} />
        {/* Amazon の表示そのままの文字列。⛔ 日付として整形しない */}
        {source.lastHighlightedText && (
          <Text fontSize="11.5px" color="text.muted">
            最後のハイライト: {source.lastHighlightedText}
          </Text>
        )}
      </Flex>

      <Flex gap={2} wrap="wrap" mt="6px" pl="28px">
        <Chip>{SOURCE_LABELS[source.source] ?? source.source}</Chip>
        {/* 🔑 「何を読んだか」と「どこから取ったか」は別の軸。両方 出す */}
        {source.ingestVia && (
          <Chip>{INGEST_LABELS[source.ingestVia] ?? source.ingestVia}</Chip>
        )}
        {source.tags.map((tag) => (
          <Chip key={tag}>#{tag}</Chip>
        ))}
      </Flex>

      {source.importNotice && (
        <Box pl="28px">
          <ImportNotice notice={source.importNotice} />
        </Box>
      )}
    </Box>
  );
}
