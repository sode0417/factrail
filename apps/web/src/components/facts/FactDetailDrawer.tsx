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
  Button,
  Icon,
  Code,
  Flex,
  Spinner,
} from '@chakra-ui/react';
import { FiExternalLink } from 'react-icons/fi';
import { useState, useEffect } from 'react';
import apiClient from '@/lib/axios';
import { getSourceLabel, getSourceTagColors, formatDate, stripMarkdown } from '@/lib/factUtils';
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

  const sourceTagColors = getSourceTagColors(displayFact.source);

  return (
    <Drawer isOpen={isOpen} onClose={onClose} placement="right" size="xl">
      <DrawerOverlay bg="rgba(40, 32, 14, 0.35)" />
      <DrawerContent
        bg="bg.surface"
        borderLeft="1px solid"
        borderColor="border.muted"
        maxW="min(960px, 60vw)"
      >
        <DrawerCloseButton
          size="lg"
          color="text.muted"
          _hover={{ bg: 'accent.soft', color: 'accent.strong' }}
        />

        <DrawerHeader pb={3} px={6} pt={5}>
          <VStack align="stretch" spacing={3}>
            <Text
              fontSize="xl"
              fontWeight={700}
              fontFamily="heading"
              color="text.default"
              pr={8}
            >
              {displayFact.title}
            </Text>
            {displayFact.summary && !['github', 'slack'].includes(displayFact.source) && (
              <Text fontSize="md" color="text.muted" noOfLines={3}>
                {stripMarkdown(displayFact.summary)}
              </Text>
            )}
            <HStack spacing={2} flexWrap="wrap" justify="space-between">
              <HStack spacing={2} flexWrap="wrap">
                <Badge
                  bg={sourceTagColors.bg}
                  color={sourceTagColors.color}
                  fontSize="sm"
                  px={2}
                  py={0.5}
                  borderRadius="sm"
                  fontWeight={500}
                >
                  {getSourceLabel(displayFact.source)}
                </Badge>
                <Badge
                  bg="bg.canvas"
                  color="text.muted"
                  border="1px solid"
                  borderColor="border.muted"
                  fontSize="sm"
                  px={2}
                  py={0.5}
                  borderRadius="sm"
                  fontWeight={500}
                >
                  {displayFact.type}
                </Badge>
                <Text fontSize="sm" color="text.muted">
                  {formatRelativeTime(displayFact.occurredAt)} ({formatDate(displayFact.occurredAt)})
                </Text>
              </HStack>
              {displayFact.sourceUrl && (
                <Button
                  as="a"
                  href={displayFact.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                  bg="accent.soft"
                  color="accent.strong"
                  borderRadius="pill"
                  _hover={{ bg: 'accent.default', color: 'white' }}
                  rightIcon={<Icon as={FiExternalLink} boxSize={3} />}
                >
                  {getSourceLabel(displayFact.source)} で表示
                </Button>
              )}
            </HStack>
          </VStack>
        </DrawerHeader>

        <Divider borderColor="border.muted" />

        <DrawerBody py={5} px={6}>
          {loading ? (
            <Flex justify="center" py={8}>
              <Spinner size="md" color="accent.default" />
            </Flex>
          ) : (
            <SourceDetail fact={displayFact} />
          )}
        </DrawerBody>

        <Divider borderColor="border.muted" />

        <DrawerFooter justifyContent="flex-start">
          <VStack align="stretch" spacing={1} w="100%">
            <HStack spacing={2} flexWrap="wrap">
              {category && (
                <Badge
                  bg={category.color || '#E4DFD1'}
                  color="white"
                  fontSize="xs"
                  borderRadius="sm"
                >
                  {category.name}
                </Badge>
              )}
              {project && (
                <Badge
                  bg="#D6E0E8"
                  color="#1F3A52"
                  fontSize="xs"
                  borderRadius="sm"
                >
                  {project.title}
                </Badge>
              )}
            </HStack>
            {displayFact.externalId && (
              <Code fontSize="xs" color="text.muted" bg="transparent">
                {displayFact.externalId}
              </Code>
            )}
          </VStack>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
