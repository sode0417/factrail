'use client';

import {
  Box,
  Card,
  CardBody,
  VStack,
  HStack,
  Text,
  Badge,
  Flex,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Button,
  Spinner,
  Icon,
  IconButton,
  Collapse,
} from '@chakra-ui/react';
import { MainLayout } from '@/components/layout';
import { DateFilter } from '@/components/facts';
import { FiSearch, FiExternalLink, FiRefreshCw, FiChevronDown, FiChevronRight, FiLayers } from 'react-icons/fi';
import { useState, useEffect, useCallback, Suspense } from 'react';
import apiClient from '@/lib/axios';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { useDateFilter } from '@/hooks/useDateFilter';

interface Fact {
  id: string;
  externalId: string;
  source: string;
  sourceUrl: string | null;
  occurredAt: string;
  title: string;
  summary: string | null;
  type: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  groupId?: string | null;
  groupType?: string | null;
  childCount?: number;
}

interface FactsResponse {
  data: Fact[];
  meta: {
    hasMore: boolean;
    nextCursor?: string;
  };
}

function getSourceColor(source: string): string {
  switch (source) {
    case 'github':
      return 'purple';
    case 'slack':
      return 'green';
    case 'manual':
      return 'blue';
    default:
      return 'gray';
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ポーリング間隔（30秒）
const POLLING_INTERVAL = 30000;

function FactsPageContent() {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBackgroundUpdate, setIsBackgroundUpdate] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [grouped, setGrouped] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [childrenMap, setChildrenMap] = useState<Record<string, Fact[]>>({});

  const {
    from,
    to,
    preset,
    isActive: dateFilterActive,
    setDateRange,
    applyPreset,
    clearFilter,
    apiParams,
  } = useDateFilter();

  const fetchFacts = useCallback(
    async (isBackground = false) => {
      if (!isBackground) {
        setLoading(true);
      } else {
        setIsBackgroundUpdate(true);
      }

      try {
        const params = new URLSearchParams();
        if (sourceFilter) params.append('source', sourceFilter);
        if (apiParams.from) params.append('from', apiParams.from);
        if (apiParams.to) params.append('to', apiParams.to);
        if (grouped) params.append('grouped', 'true');

        const response = await apiClient.get<FactsResponse>(
          `/api/facts?${params.toString()}`,
        );
        setFacts(response.data.data);
      } catch (error) {
        console.error('Failed to fetch facts:', error);
      } finally {
        setLoading(false);
        setIsBackgroundUpdate(false);
      }
    },
    [sourceFilter, apiParams.from, apiParams.to, grouped],
  );

  const toggleExpand = useCallback(async (factId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(factId)) {
        next.delete(factId);
      } else {
        next.add(factId);
      }
      return next;
    });

    if (!childrenMap[factId]) {
      try {
        const response = await apiClient.get<{ data: Fact[] }>(
          `/api/facts/${factId}/children`,
        );
        setChildrenMap((prev) => ({ ...prev, [factId]: response.data.data }));
      } catch (error) {
        console.error('Failed to fetch children:', error);
      }
    }
  }, [childrenMap]);

  // 初回ロードとフィルター変更時のフェッチ
  useEffect(() => {
    fetchFacts();
  }, [fetchFacts]);

  // 30秒ごとのポーリング
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchFacts(true);
    }, POLLING_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchFacts]);

  const filteredFacts = facts.filter((fact) => {
    if (!searchQuery) return true;
    return (
      fact.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fact.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fact.type.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <MainLayout title="Facts" subtitle="収集されたすべてのファクトを表示">
      {/* Filters */}
      <Card bg="gray.800" borderColor="gray.700" borderWidth="1px" mb={6}>
        <CardBody>
          <VStack spacing={4} align="stretch">
            <Flex gap={4} flexWrap="wrap">
              <InputGroup maxW="300px">
                <InputLeftElement pointerEvents="none">
                  <FiSearch color="gray" />
                </InputLeftElement>
                <Input
                  placeholder="検索..."
                  bg="gray.900"
                  border="none"
                  _placeholder={{ color: 'gray.500' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </InputGroup>

              <Select
                maxW="200px"
                bg="gray.900"
                borderColor="gray.700"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                <option value="">すべてのソース</option>
                <option value="github">GitHub</option>
                <option value="slack">Slack</option>
                <option value="manual">Manual</option>
              </Select>

              <Button
                leftIcon={<Icon as={FiLayers} />}
                variant={grouped ? 'solid' : 'outline'}
                colorScheme={grouped ? 'brand' : 'gray'}
                onClick={() => {
                  setGrouped((v) => !v);
                  setExpandedIds(new Set());
                  setChildrenMap({});
                }}
              >
                グループ表示
              </Button>

              <Button
                leftIcon={
                  <FiRefreshCw
                    className={isBackgroundUpdate ? 'animate-spin' : ''}
                  />
                }
                variant="outline"
                colorScheme="gray"
                onClick={() => fetchFacts(false)}
                isLoading={loading}
              >
                更新
              </Button>
            </Flex>

            <DateFilter
              from={from}
              to={to}
              preset={preset}
              isActive={dateFilterActive}
              onPreset={applyPreset}
              onRangeChange={setDateRange}
              onClear={clearFilter}
            />
          </VStack>
        </CardBody>
      </Card>

      {/* Facts List */}
      {loading ? (
        <Flex justify="center" py={10}>
          <Spinner size="xl" color="brand.500" />
        </Flex>
      ) : filteredFacts.length === 0 ? (
        <Card bg="gray.800" borderColor="gray.700" borderWidth="1px">
          <CardBody>
            <Flex justify="center" align="center" py={10}>
              <Text color="gray.500">Factsが見つかりませんでした</Text>
            </Flex>
          </CardBody>
        </Card>
      ) : (
        <VStack spacing={4} align="stretch">
          {filteredFacts.map((fact) => (
            <Box key={fact.id}>
              <Card
                bg="gray.800"
                borderColor="gray.700"
                borderWidth="1px"
                _hover={{ borderColor: 'gray.600' }}
                transition="all 0.2s"
              >
                <CardBody>
                  <Flex justify="space-between" align="flex-start">
                    <HStack spacing={4} align="flex-start">
                      {grouped && fact.childCount !== undefined && fact.childCount > 0 ? (
                        <IconButton
                          aria-label="展開/折りたたみ"
                          icon={<Icon as={expandedIds.has(fact.id) ? FiChevronDown : FiChevronRight} />}
                          size="sm"
                          variant="ghost"
                          colorScheme="gray"
                          onClick={() => toggleExpand(fact.id)}
                          mt={1}
                        />
                      ) : (
                        <Box
                          w={1}
                          h="full"
                          minH="60px"
                          borderRadius="full"
                          bg={`${getSourceColor(fact.source)}.500`}
                        />
                      )}
                      <Box>
                        <HStack spacing={2} mb={1}>
                          <Text fontWeight="semibold" fontSize="lg">
                            {fact.title}
                          </Text>
                          {grouped && fact.childCount !== undefined && fact.childCount > 0 && (
                            <Badge colorScheme="blue" variant="solid" fontSize="xs">
                              +{fact.childCount}
                            </Badge>
                          )}
                        </HStack>
                        {fact.summary && (
                          <Text fontSize="sm" color="gray.400" mb={2}>
                            {fact.summary}
                          </Text>
                        )}
                        <HStack spacing={2} flexWrap="wrap">
                          <Badge
                            colorScheme={getSourceColor(fact.source)}
                            variant="subtle"
                          >
                            {fact.source}
                          </Badge>
                          <Badge colorScheme="gray" variant="outline">
                            {fact.type}
                          </Badge>
                          <Text fontSize="xs" color="gray.500">
                            {formatRelativeTime(fact.occurredAt)} (
                            {formatDate(fact.occurredAt)})
                          </Text>
                        </HStack>
                      </Box>
                    </HStack>

                    {fact.sourceUrl && (
                      <Button
                        as="a"
                        href={fact.sourceUrl}
                        target="_blank"
                        size="sm"
                        variant="ghost"
                        colorScheme="gray"
                        rightIcon={<Icon as={FiExternalLink} />}
                      >
                        開く
                      </Button>
                    )}
                  </Flex>
                </CardBody>
              </Card>

              {/* 子 Fact の展開表示 */}
              {grouped && expandedIds.has(fact.id) && (
                <VStack spacing={2} align="stretch" pl={8} pt={2}>
                  {childrenMap[fact.id] ? (
                    childrenMap[fact.id].map((child) => (
                      <Card
                        key={child.id}
                        bg="gray.750"
                        borderColor="gray.600"
                        borderWidth="1px"
                        borderLeftWidth="3px"
                        borderLeftColor={`${getSourceColor(child.source)}.500`}
                        size="sm"
                      >
                        <CardBody py={3} px={4}>
                          <Text fontWeight="medium" fontSize="sm" mb={1}>
                            {child.title}
                          </Text>
                          <HStack spacing={2} flexWrap="wrap">
                            <Badge colorScheme="gray" variant="outline" fontSize="xs">
                              {child.type}
                            </Badge>
                            <Text fontSize="xs" color="gray.500">
                              {formatRelativeTime(child.occurredAt)}
                            </Text>
                            {child.sourceUrl && (
                              <Button
                                as="a"
                                href={child.sourceUrl}
                                target="_blank"
                                size="xs"
                                variant="ghost"
                                colorScheme="gray"
                                rightIcon={<Icon as={FiExternalLink} boxSize={3} />}
                              >
                                開く
                              </Button>
                            )}
                          </HStack>
                        </CardBody>
                      </Card>
                    ))
                  ) : (
                    <Flex justify="center" py={2}>
                      <Spinner size="sm" color="gray.500" />
                    </Flex>
                  )}
                </VStack>
              )}
            </Box>
          ))}
        </VStack>
      )}
    </MainLayout>
  );
}

export default function FactsPage() {
  return (
    <Suspense
      fallback={
        <MainLayout title="Facts" subtitle="収集されたすべてのファクトを表示">
          <Flex justify="center" py={10}>
            <Spinner size="xl" color="brand.500" />
          </Flex>
        </MainLayout>
      }
    >
      <FactsPageContent />
    </Suspense>
  );
}
