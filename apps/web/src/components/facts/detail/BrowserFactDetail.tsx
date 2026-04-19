'use client';

import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Link,
} from '@chakra-ui/react';
import { FiExternalLink, FiClock, FiFileText, FiGlobe, FiSearch } from 'react-icons/fi';
import { Icon } from '@chakra-ui/react';
import type { Fact } from '@/types/fact';

interface BrowserFactDetailProps {
  fact: Fact;
}

interface UrlEntry {
  url: string;
  title: string;
}

export function BrowserFactDetail({ fact }: BrowserFactDetailProps) {
  const metadata = fact.metadata ?? {};
  const urls = (metadata.urls as UrlEntry[]) ?? [];
  const searchQueries = (metadata.search_queries as string[]) ?? [];
  const domains = (metadata.domains as string[]) ?? [];
  const durationMin = metadata.duration_min as number | undefined;
  const visitCount = metadata.visit_count as number | undefined;

  return (
    <VStack spacing={4} align="stretch">
      {/* 統計バー */}
      <HStack spacing={4} flexWrap="wrap">
        {durationMin != null && (
          <HStack spacing={1} color="text.default">
            <Icon as={FiClock} boxSize={4} />
            <Text fontSize="sm" fontWeight="medium">{durationMin}分</Text>
          </HStack>
        )}
        {visitCount != null && (
          <HStack spacing={1} color="text.default">
            <Icon as={FiFileText} boxSize={4} />
            <Text fontSize="sm" fontWeight="medium">{visitCount}ページ</Text>
          </HStack>
        )}
        {domains.length > 0 && (
          <HStack spacing={1} color="text.default">
            <Icon as={FiGlobe} boxSize={4} />
            <Text fontSize="sm" fontWeight="medium">{domains.length}ドメイン</Text>
          </HStack>
        )}
      </HStack>

      {/* 訪問ページ */}
      {urls.length > 0 && (
        <Box>
          <Text fontSize="xs" color="text.muted" fontWeight="bold" mb={2} textTransform="uppercase" letterSpacing="wider">
            訪問ページ
          </Text>
          <VStack spacing={1} align="stretch">
            {urls.map((entry, i) => (
              <Link
                key={i}
                href={entry.url}
                isExternal
                fontSize="sm"
                color="blue.300"
                _hover={{ color: 'blue.200', textDecoration: 'underline' }}
                noOfLines={1}
                display="flex"
                alignItems="center"
                gap={1}
              >
                <Icon as={FiExternalLink} boxSize={3} flexShrink={0} />
                {entry.title || entry.url}
              </Link>
            ))}
          </VStack>
        </Box>
      )}

      {/* 検索クエリ */}
      {searchQueries.length > 0 && (
        <Box>
          <Text fontSize="xs" color="text.muted" fontWeight="bold" mb={2} textTransform="uppercase" letterSpacing="wider">
            検索クエリ
          </Text>
          <HStack spacing={2} flexWrap="wrap">
            {searchQueries.map((q, i) => (
              <Badge key={i} colorScheme="orange" variant="subtle" fontSize="xs">
                <Icon as={FiSearch} boxSize={3} mr={1} />
                {q}
              </Badge>
            ))}
          </HStack>
        </Box>
      )}

      {/* ドメイン集計 */}
      {domains.length > 0 && (
        <Box>
          <Text fontSize="xs" color="text.muted" fontWeight="bold" mb={2} textTransform="uppercase" letterSpacing="wider">
            ドメイン
          </Text>
          <HStack spacing={2} flexWrap="wrap">
            {domains.map((domain, i) => (
              <Badge key={i} colorScheme="gray" variant="outline" fontSize="xs">
                {domain}
              </Badge>
            ))}
          </HStack>
        </Box>
      )}
    </VStack>
  );
}
