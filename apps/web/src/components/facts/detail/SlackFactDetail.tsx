'use client';

import {
  Box,
  VStack,
  Text,
  Link,
  Icon,
} from '@chakra-ui/react';
import { FiExternalLink } from 'react-icons/fi';
import { MarkdownContent } from './MarkdownContent';
import type { Fact } from '@/types/fact';

interface SlackFactDetailProps {
  fact: Fact;
}

export function SlackFactDetail({ fact }: SlackFactDetailProps) {
  const metadata = fact.metadata ?? {};
  const channel = metadata.channel as string | undefined;
  const content = fact.content || fact.summary;

  return (
    <VStack spacing={4} align="stretch">
      {channel && (
        <Text fontSize="sm" color="text.muted">
          #{channel}
        </Text>
      )}

      {/* メッセージ本文 */}
      {content && (
        <Box>
          <Text fontSize="xs" color="text.muted" fontWeight="bold" mb={2} textTransform="uppercase" letterSpacing="wider">
            メッセージ
          </Text>
          <Box
            bg="bg.surface-2"
            borderRadius="md"
            p={3}
            borderLeft="3px solid"
            borderColor="green.500"
          >
            <MarkdownContent content={content} />
          </Box>
        </Box>
      )}

      {fact.sourceUrl && (
        <Link
          href={fact.sourceUrl}
          isExternal
          fontSize="sm"
          color="green.300"
          _hover={{ color: 'green.200' }}
          display="flex"
          alignItems="center"
          gap={1}
        >
          <Icon as={FiExternalLink} boxSize={3} />
          Slack で表示
        </Link>
      )}
    </VStack>
  );
}
