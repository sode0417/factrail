'use client';

import {
  Box,
  VStack,
  HStack,
  Text,
  Link,
  Icon,
  Code,
} from '@chakra-ui/react';
import { FiGitCommit, FiGitBranch } from 'react-icons/fi';
import { MarkdownContent } from './MarkdownContent';
import type { Fact } from '@/types/fact';

interface GithubFactDetailProps {
  fact: Fact;
}

interface CommitEntry {
  id?: string;
  message?: string;
  url?: string;
}

export function GithubFactDetail({ fact }: GithubFactDetailProps) {
  const metadata = fact.metadata ?? {};
  const commits = (metadata.commits as CommitEntry[]) ?? [];
  const headCommit = metadata.head_commit as CommitEntry | undefined;
  const ref = metadata.ref as string | undefined;
  const repo = metadata.repository as string | undefined;
  const body = (fact.content || fact.summary) ?? '';

  const allCommits = commits.length > 0
    ? commits
    : headCommit
      ? [headCommit]
      : [];

  return (
    <VStack spacing={4} align="stretch">
      {/* ブランチ情報 */}
      {ref && (
        <HStack spacing={2}>
          <Icon as={FiGitBranch} color="gray.400" boxSize={4} />
          <Code fontSize="sm" bg="gray.700" color="gray.200" px={2} py={0.5} borderRadius="md">
            {ref.replace('refs/heads/', '')}
          </Code>
          {repo && (
            <Text fontSize="sm" color="gray.500">{repo}</Text>
          )}
        </HStack>
      )}

      {/* Issue / PR 本文 */}
      {body && (
        <Box>
          <Text fontSize="xs" color="gray.500" fontWeight="bold" mb={2} textTransform="uppercase" letterSpacing="wider">
            本文
          </Text>
          <Box
            bg="gray.850"
            borderRadius="md"
            p={3}
            maxH="none"
            overflowY="auto"
            sx={{
              '&::-webkit-scrollbar': { width: '4px' },
              '&::-webkit-scrollbar-thumb': { bg: 'gray.700', borderRadius: 'full' },
            }}
          >
            <MarkdownContent content={body} />
          </Box>
        </Box>
      )}

      {/* コミット一覧 */}
      {allCommits.length > 0 && (
        <Box>
          <Text fontSize="xs" color="gray.500" fontWeight="bold" mb={2} textTransform="uppercase" letterSpacing="wider">
            コミット
          </Text>
          <VStack spacing={2} align="stretch">
            {allCommits.map((commit, i) => (
              <HStack key={i} spacing={2} align="flex-start">
                <Icon as={FiGitCommit} color="purple.400" boxSize={4} mt={0.5} flexShrink={0} />
                <Box flex={1}>
                  {commit.url ? (
                    <Link
                      href={commit.url}
                      isExternal
                      fontSize="sm"
                      color="purple.300"
                      _hover={{ color: 'purple.200' }}
                    >
                      <Code fontSize="xs" bg="gray.700" color="gray.300" mr={2}>
                        {commit.id?.substring(0, 7) ?? '?'}
                      </Code>
                      {commit.message?.split('\n')[0] ?? ''}
                    </Link>
                  ) : (
                    <Text fontSize="sm" color="gray.200">
                      <Code fontSize="xs" bg="gray.700" color="gray.300" mr={2}>
                        {commit.id?.substring(0, 7) ?? '?'}
                      </Code>
                      {commit.message?.split('\n')[0] ?? ''}
                    </Text>
                  )}
                </Box>
              </HStack>
            ))}
          </VStack>
        </Box>
      )}

    </VStack>
  );
}
