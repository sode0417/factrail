'use client';

import {
  Box,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Card,
  CardBody,
  Icon,
  Flex,
  Text,
  VStack,
  HStack,
  Badge,
  Spinner,
} from '@chakra-ui/react';
import { MainLayout } from '@/components/layout';
import { FiGithub, FiMessageSquare, FiActivity } from 'react-icons/fi';
import { IconType } from 'react-icons';
import { useState, useEffect } from 'react';
import apiClient from '@/lib/axios';
import { formatRelativeTime } from '@/lib/formatRelativeTime';

interface StatCardProps {
  label: string;
  value: string;
  helpText: string;
  icon: IconType;
  color: string;
}

function StatCard({ label, value, helpText, icon, color }: StatCardProps) {
  return (
    <Card bg="gray.800" borderColor="gray.700" borderWidth="1px">
      <CardBody>
        <Flex justify="space-between" align="flex-start">
          <Stat>
            <StatLabel color="gray.400" fontSize="sm">
              {label}
            </StatLabel>
            <StatNumber fontSize="3xl" fontFamily="heading" mt={2}>
              {value}
            </StatNumber>
            <StatHelpText color="gray.500" fontSize="xs" mt={1}>
              {helpText}
            </StatHelpText>
          </Stat>
          <Box p={3} borderRadius="lg" bg={`${color}.900`}>
            <Icon as={icon} boxSize={6} color={`${color}.400`} />
          </Box>
        </Flex>
      </CardBody>
    </Card>
  );
}

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

interface FactsStatsResponse {
  todayCount: number;
}

// ポーリング間隔（30秒）
const POLLING_INTERVAL = 30000;

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

export default function DashboardPage() {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [stats, setStats] = useState<FactsStatsResponse>({ todayCount: 0 });
  const [loading, setLoading] = useState(true);

  const fetchFacts = async () => {
    try {
      const response = await apiClient.get<FactsResponse>(
        `/api/facts?limit=5`
      );
      setFacts(response.data.data);
    } catch (error) {
      console.error('Failed to fetch facts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.get<FactsStatsResponse>(
        `/api/facts/stats`
      );
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  // 初回ロード
  useEffect(() => {
    fetchFacts();
    fetchStats();
  }, []);

  // 30秒ごとのポーリング
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchFacts();
      fetchStats();
    }, POLLING_INTERVAL);

    // クリーンアップ
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return (
    <MainLayout title="ダッシュボード" subtitle="Factrailの概要を確認">
      {/* Stats Grid */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6} mb={8}>
        <StatCard
          label="今日のアクティビティ"
          value={loading ? '-' : stats.todayCount.toString()}
          helpText="直近24時間"
          icon={FiActivity}
          color="accent"
        />
        <StatCard
          label="GitHub連携"
          value="未接続"
          helpText="設定が必要です"
          icon={FiGithub}
          color="purple"
        />
        <StatCard
          label="Slack連携"
          value="未接続"
          helpText="設定が必要です"
          icon={FiMessageSquare}
          color="green"
        />
      </SimpleGrid>

      {/* Recent Activity */}
      <Card bg="gray.800" borderColor="gray.700" borderWidth="1px">
        <CardBody>
          <Text fontSize="lg" fontWeight="semibold" mb={4}>
            最近のアクティビティ
          </Text>
          {loading ? (
            <Flex justify="center" py={10}>
              <Spinner size="lg" color="brand.500" />
            </Flex>
          ) : facts.length === 0 ? (
            <Flex justify="center" py={10}>
              <Text color="gray.500">アクティビティがありません</Text>
            </Flex>
          ) : (
            <VStack spacing={4} align="stretch">
              {facts.map((fact) => (
                <Flex
                  key={fact.id}
                  p={4}
                  bg="gray.900"
                  borderRadius="lg"
                  justify="space-between"
                  align="center"
                >
                  <HStack spacing={4}>
                    <Box
                      w={2}
                      h={10}
                      borderRadius="full"
                      bg={`${getSourceColor(fact.source)}.500`}
                    />
                    <Box>
                      <Text fontWeight="medium">{fact.title}</Text>
                      <HStack spacing={2} mt={1}>
                        <Badge
                          colorScheme={getSourceColor(fact.source)}
                          variant="subtle"
                          fontSize="xs"
                        >
                          {fact.source}
                        </Badge>
                        <Text fontSize="xs" color="gray.500">
                          {fact.type}
                        </Text>
                      </HStack>
                    </Box>
                  </HStack>
                  <Text fontSize="sm" color="gray.500">
                    {formatRelativeTime(fact.occurredAt)}
                  </Text>
                </Flex>
              ))}
            </VStack>
          )}
        </CardBody>
      </Card>
    </MainLayout>
  );
}
