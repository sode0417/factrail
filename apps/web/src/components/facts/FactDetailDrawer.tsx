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
  Flex,
  Spinner,
} from '@chakra-ui/react';
import { FiExternalLink } from 'react-icons/fi';
import { useState, useEffect } from 'react';
import apiClient from '@/lib/axios';
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
  const [detailCache, setDetailCache] = useState<Record<string, Fact>>({});

  // ドロワーが開かれたとき、全文を取得
  useEffect(() => {
    if (!isOpen || !fact || detailCache[fact.id]) return;

    let cancelled = false;

    apiClient
      .get<{ data: Fact }>(`/api/facts/${fact.id}`)
      .then((res) => {
        if (!cancelled) {
          setDetailCache((prev) => ({ ...prev, [fact.id]: res.data.data }));
        }
      })
      .catch((err) => {
        console.error('Failed to fetch fact detail:', err);
        if (!cancelled) {
          setDetailCache((prev) => ({ ...prev, [fact.id]: fact }));
        }
      });

    return () => { cancelled = true; };
  }, [isOpen, fact, detailCache]);

  if (!fact) return null;

  const displayFact = detailCache[fact.id] ?? fact;
  const loading = isOpen && !detailCache[fact.id];
  const category = displayFact.categoryId ? categories.find((c) => c.id === displayFact.categoryId) : null;
  const project = displayFact.projectId ? projects.find((p) => p.id === displayFact.projectId) : null;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} placement="right" size="xl">
      <DrawerOverlay />
      <DrawerContent bg="gray.800" borderColor="gray.700" borderLeftWidth="1px">
        <DrawerCloseButton size="lg" />

        <DrawerHeader pb={3} px={6} pt={5}>
          <VStack align="stretch" spacing={3}>
            <Text fontSize="xl" fontWeight="bold" color="gray.100" pr={8}>
              {displayFact.title}
            </Text>
            {displayFact.summary && !['github', 'slack'].includes(displayFact.source) && (
              <Text fontSize="md" color="gray.400" noOfLines={3}>
                {stripMarkdown(displayFact.summary)}
              </Text>
            )}
            <HStack spacing={2} flexWrap="wrap">
              <Badge colorScheme={getSourceColor(displayFact.source)} variant="subtle" fontSize="sm" px={2} py={0.5}>
                {getSourceLabel(displayFact.source)}
              </Badge>
              <Badge colorScheme="gray" variant="outline" fontSize="sm" px={2} py={0.5}>
                {displayFact.type}
              </Badge>
              {displayFact.sourceUrl && (
                <Link
                  href={displayFact.sourceUrl}
                  isExternal
                  display="flex"
                  alignItems="center"
                  gap={1}
                >
                  <Icon as={FiExternalLink} boxSize={4} color="gray.400" />
                </Link>
              )}
            </HStack>
            <Text fontSize="sm" color="gray.500">
              {formatRelativeTime(displayFact.occurredAt)} ({formatDate(displayFact.occurredAt)})
            </Text>
          </VStack>
        </DrawerHeader>

        <Divider borderColor="gray.700" />

        <DrawerBody py={5} px={6}>
          {loading ? (
            <Flex justify="center" py={8}>
              <Spinner size="md" color="gray.500" />
            </Flex>
          ) : (
            <SourceDetail fact={displayFact} />
          )}
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
            {displayFact.externalId && (
              <Code fontSize="xs" color="gray.600" bg="transparent">
                {displayFact.externalId}
              </Code>
            )}
          </VStack>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
