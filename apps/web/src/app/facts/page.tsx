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
} from '@chakra-ui/react';
import { MainLayout } from '@/components/layout';
import { FiSearch, FiExternalLink, FiRefreshCw } from 'react-icons/fi';
import { useState, useEffect } from 'react';
import axios from 'axios';

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

export default function FactsPage() {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://factrail-production.up.railway.app';

  const fetchFacts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sourceFilter) params.append('source', sourceFilter);
      
      const response = await axios.get<FactsResponse>(
        `${apiUrl}/api/facts?${params.toString()}`
      );
      setFacts(response.data.data);
    } catch (error) {
      console.error('Failed to fetch facts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFacts();
  }, [sourceFilter]);

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
              leftIcon={<FiRefreshCw />}
              variant="outline"
              colorScheme="gray"
              onClick={fetchFacts}
              isLoading={loading}
            >
              更新
            </Button>
          </Flex>
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
            <Card
              key={fact.id}
              bg="gray.800"
              borderColor="gray.700"
              borderWidth="1px"
              _hover={{ borderColor: 'gray.600' }}
              transition="all 0.2s"
            >
              <CardBody>
                <Flex justify="space-between" align="flex-start">
                  <HStack spacing={4} align="flex-start">
                    <Box
                      w={1}
                      h="full"
                      minH="60px"
                      borderRadius="full"
                      bg={`${getSourceColor(fact.source)}.500`}
                    />
                    <Box>
                      <Text fontWeight="semibold" fontSize="lg" mb={1}>
                        {fact.title}
                      </Text>
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
                          {formatDate(fact.occurredAt)}
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
          ))}
        </VStack>
      )}
    </MainLayout>
  );
}
