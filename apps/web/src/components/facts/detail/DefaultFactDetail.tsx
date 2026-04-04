'use client';

import {
  Box,
  VStack,
  Text,
  Link,
  Icon,
  Code,
} from '@chakra-ui/react';
import { FiExternalLink } from 'react-icons/fi';
import { MarkdownContent } from './MarkdownContent';
import type { Fact } from '@/types/fact';

interface DefaultFactDetailProps {
  fact: Fact;
}

export function DefaultFactDetail({ fact }: DefaultFactDetailProps) {
  return (
    <VStack spacing={4} align="stretch">
      {/* content */}
      {fact.content && (
        <Box>
          <Text fontSize="xs" color="gray.500" fontWeight="bold" mb={2} textTransform="uppercase" letterSpacing="wider">
            内容
          </Text>
          <Box bg="gray.750" borderRadius="md" p={3}>
            <MarkdownContent content={fact.content} />
          </Box>
        </Box>
      )}

      {/* metadata */}
      {fact.metadata && Object.keys(fact.metadata).length > 0 && (
        <Box>
          <Text fontSize="xs" color="gray.500" fontWeight="bold" mb={2} textTransform="uppercase" letterSpacing="wider">
            メタデータ
          </Text>
          <Box
            bg="gray.900"
            borderRadius="md"
            p={3}
            overflowX="auto"
            sx={{
              '&::-webkit-scrollbar': { height: '4px' },
              '&::-webkit-scrollbar-thumb': { bg: 'gray.700', borderRadius: 'full' },
            }}
          >
            <Code
              as="pre"
              fontSize="xs"
              color="gray.300"
              bg="transparent"
              whiteSpace="pre-wrap"
              wordBreak="break-word"
            >
              {JSON.stringify(fact.metadata, null, 2)}
            </Code>
          </Box>
        </Box>
      )}

      {/* sourceUrl */}
      {fact.sourceUrl && (
        <Link
          href={fact.sourceUrl}
          isExternal
          fontSize="sm"
          color="blue.300"
          _hover={{ color: 'blue.200' }}
          display="flex"
          alignItems="center"
          gap={1}
        >
          <Icon as={FiExternalLink} boxSize={3} />
          ソースを表示
        </Link>
      )}
    </VStack>
  );
}
