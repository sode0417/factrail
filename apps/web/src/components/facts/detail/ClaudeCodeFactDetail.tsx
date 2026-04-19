'use client';

import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Icon,
  Code,
  List,
  ListItem,
  ListIcon,
} from '@chakra-ui/react';
import { FiCheck, FiArrowRight, FiClock, FiGitCommit } from 'react-icons/fi';
import type { Fact } from '@/types/fact';

interface ClaudeCodeFactDetailProps {
  fact: Fact;
}

export function ClaudeCodeFactDetail({ fact }: ClaudeCodeFactDetailProps) {
  const metadata = fact.metadata ?? {};
  const durationMinutes = metadata.duration_minutes as number | undefined;
  const sessionType = metadata.session_type as string | undefined;
  const project = metadata.project as string | undefined;
  const accomplishments = (metadata.accomplishments as string[]) ?? [];
  const nextActions = (metadata.next_actions as string[]) ?? [];
  const commits = (metadata.commits as string[]) ?? [];
  const issuesClosed = (metadata.issues_closed as string[]) ?? [];
  const issuesReferenced = (metadata.issues_referenced as string[]) ?? [];
  const allIssues = [...new Set([...issuesClosed, ...issuesReferenced])];

  return (
    <VStack spacing={4} align="stretch">
      {/* セッション情報 */}
      <HStack spacing={3} flexWrap="wrap">
        {durationMinutes != null && (
          <HStack spacing={1} color="text.default">
            <Icon as={FiClock} boxSize={4} />
            <Text fontSize="sm" fontWeight="medium">
              {durationMinutes >= 60
                ? `${(durationMinutes / 60).toFixed(1)}h`
                : `${durationMinutes}分`}
            </Text>
          </HStack>
        )}
        {sessionType && (
          <Badge colorScheme="teal" variant="subtle" fontSize="xs">{sessionType}</Badge>
        )}
        {project && (
          <Badge colorScheme="cyan" variant="outline" fontSize="xs">{project}</Badge>
        )}
      </HStack>

      {/* 実施内容 */}
      {accomplishments.length > 0 && (
        <Box>
          <Text fontSize="xs" color="text.muted" fontWeight="bold" mb={2} textTransform="uppercase" letterSpacing="wider">
            実施内容
          </Text>
          <List spacing={1}>
            {accomplishments.map((item, i) => (
              <ListItem key={i} fontSize="sm" color="text.default" display="flex" alignItems="flex-start">
                <ListIcon as={FiCheck} color="green.400" mt={1} />
                {item}
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* コミット */}
      {commits.length > 0 && (
        <Box>
          <Text fontSize="xs" color="text.muted" fontWeight="bold" mb={2} textTransform="uppercase" letterSpacing="wider">
            コミット
          </Text>
          <VStack spacing={1} align="stretch">
            {commits.map((commit, i) => (
              <HStack key={i} spacing={2}>
                <Icon as={FiGitCommit} color="teal.400" boxSize={4} flexShrink={0} />
                <Code fontSize="xs" bg="bg.surface-2" color="text.default">{commit}</Code>
              </HStack>
            ))}
          </VStack>
        </Box>
      )}

      {/* 関連 Issue */}
      {allIssues.length > 0 && (
        <Box>
          <Text fontSize="xs" color="text.muted" fontWeight="bold" mb={2} textTransform="uppercase" letterSpacing="wider">
            関連 Issue
          </Text>
          <VStack spacing={1} align="stretch">
            {allIssues.map((issue, i) => {
              const isClosed = issuesClosed.includes(issue);
              return (
                <HStack key={i} spacing={2}>
                  <Badge
                    colorScheme={isClosed ? 'purple' : 'gray'}
                    variant="subtle"
                    fontSize="xs"
                  >
                    {isClosed ? 'closed' : 'ref'}
                  </Badge>
                  <Text fontSize="sm" color="text.default">{issue}</Text>
                </HStack>
              );
            })}
          </VStack>
        </Box>
      )}

      {/* 次のアクション */}
      {nextActions.length > 0 && (
        <Box>
          <Text fontSize="xs" color="text.muted" fontWeight="bold" mb={2} textTransform="uppercase" letterSpacing="wider">
            次のアクション
          </Text>
          <List spacing={1}>
            {nextActions.map((item, i) => (
              <ListItem key={i} fontSize="sm" color="text.default" display="flex" alignItems="flex-start">
                <ListIcon as={FiArrowRight} color="teal.400" mt={1} />
                {item}
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* content フォールバック */}
      {fact.content && accomplishments.length === 0 && (
        <Box>
          <Text fontSize="xs" color="text.muted" fontWeight="bold" mb={2} textTransform="uppercase" letterSpacing="wider">
            詳細
          </Text>
          <Box bg="bg.surface-2" borderRadius="md" p={3}>
            <Text fontSize="sm" color="text.default" whiteSpace="pre-wrap">
              {fact.content}
            </Text>
          </Box>
        </Box>
      )}
    </VStack>
  );
}
