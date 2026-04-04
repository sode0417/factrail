'use client';

import {
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  VStack,
  HStack,
  Text,
  Badge,
  Divider,
  Link,
  Icon,
  Code,
} from '@chakra-ui/react';
import { FiExternalLink } from 'react-icons/fi';
import { getSourceColor, getSourceLabel, formatDate, stripMarkdown } from '@/lib/factUtils';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { BrowserFactDetail } from './detail/BrowserFactDetail';
import { GithubFactDetail } from './detail/GithubFactDetail';
import { SlackFactDetail } from './detail/SlackFactDetail';
import { ClaudeCodeFactDetail } from './detail/ClaudeCodeFactDetail';
import { DefaultFactDetail } from './detail/DefaultFactDetail';
import type { Fact, F2ACategory, F2AProject } from '@/types/fact';

interface FactDetailDrawerProps {
  fact: Fact | null;
  isOpen: boolean;
  onClose: () => void;
  categories: F2ACategory[];
  projects: F2AProject[];
}

function SourceDetail({ fact }: { fact: Fact }) {
  switch (fact.source) {
    case 'browser':
      return <BrowserFactDetail fact={fact} />;
    case 'github':
      return <GithubFactDetail fact={fact} />;
    case 'slack':
      return <SlackFactDetail fact={fact} />;
    case 'claude-code':
      return <ClaudeCodeFactDetail fact={fact} />;
    default:
      return <DefaultFactDetail fact={fact} />;
  }
}

export function FactDetailDrawer({
  fact,
  isOpen,
  onClose,
  categories,
  projects,
}: FactDetailDrawerProps) {
  if (!fact) return null;

  const category = fact.categoryId ? categories.find((c) => c.id === fact.categoryId) : null;
  const project = fact.projectId ? projects.find((p) => p.id === fact.projectId) : null;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} placement="right" size="md">
      <DrawerOverlay />
      <DrawerContent bg="gray.800" borderColor="gray.700" borderLeftWidth="1px">
        <DrawerCloseButton />

        <DrawerHeader pb={2}>
          <VStack align="stretch" spacing={2}>
            <Text fontSize="lg" fontWeight="bold" color="gray.100" pr={6}>
              {fact.title}
            </Text>
            {fact.summary && !['github', 'slack'].includes(fact.source) && (
              <Text fontSize="sm" color="gray.400" noOfLines={3}>
                {stripMarkdown(fact.summary)}
              </Text>
            )}
            <HStack spacing={2} flexWrap="wrap">
              <Badge colorScheme={getSourceColor(fact.source)} variant="subtle">
                {getSourceLabel(fact.source)}
              </Badge>
              <Badge colorScheme="gray" variant="outline">
                {fact.type}
              </Badge>
              {fact.sourceUrl && (
                <Link
                  href={fact.sourceUrl}
                  isExternal
                  display="flex"
                  alignItems="center"
                  gap={1}
                >
                  <Icon as={FiExternalLink} boxSize={3} color="gray.400" />
                </Link>
              )}
            </HStack>
            <Text fontSize="xs" color="gray.500">
              {formatRelativeTime(fact.occurredAt)} ({formatDate(fact.occurredAt)})
            </Text>
          </VStack>
        </DrawerHeader>

        <Divider borderColor="gray.700" />

        <DrawerBody py={4}>
          <SourceDetail fact={fact} />
        </DrawerBody>

        <Divider borderColor="gray.700" />

        <DrawerFooter justifyContent="flex-start">
          <VStack align="stretch" spacing={1} w="100%">
            <HStack spacing={2} flexWrap="wrap">
              {category && (
                <Badge bg={category.color} color="white" fontSize="xs">
                  {category.name}
                </Badge>
              )}
              {project && (
                <Badge colorScheme="cyan" variant="subtle" fontSize="xs">
                  {project.title}
                </Badge>
              )}
            </HStack>
            {fact.externalId && (
              <Code fontSize="xs" color="gray.600" bg="transparent">
                {fact.externalId}
              </Code>
            )}
          </VStack>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
