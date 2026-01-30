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
import { FiDatabase, FiGithub, FiMessageSquare, FiActivity } from 'react-icons/fi';
import { IconType } from 'react-icons';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
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

interface DashboardStats {
  totalFacts: number;
  factsLast30Days: number;
  todayActivity: number;
}

// ポーリング間隔（ミリ秒）
const POLLING_INTERVAL = 30000; // 30秒

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
  const [recentFacts, setRecentFacts] = useState<Fact[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalFacts: 0,
    factsLast30Days: 0,
    todayActivity: 0,
  });
  const [loading, setLoading] = useState(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://factrail-production.up.railway.app';

  const fetchDashboardData = async () => {
    try {
      // 最新の5件のFactsを取得
      const factsResponse = await axios.get<FactsResponse>(
        `${apiUrl}/api/facts?limit=5`
      );
      setRecentFacts(factsResponse.data.data);

      // 統計情報を計算
      const allFactsResponse = await axios.get<FactsResponse>(
        `${apiUrl}/api/facts?limit=1000`
      );
      const allFacts = allFactsResponse.data.data;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const factsLast30Days = allFacts.filter(
        (fact) => new Date(fact.createdAt) >= thirtyDaysAgo
      ).length;

      const todayActivity = allFacts.filter(
        (fact) => new Date(fact.createdAt) >= oneDayAgo
      ).length;

      setStats({
        totalFacts: allFacts.length,
        factsLast30Days,
        todayActivity,
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初回ロード
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // ポーリングの設定
  useEffect(() => {
    pollingIntervalRef.current = setInterval(() => {
      fetchDashboardData();
    }, POLLING_INTERVAL);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <MainLayout title="ダッシュボード" subtitle="Factrailの概要を確認">
        <Flex justify="center" align="center" minH="400px">
          <Spinner size="xl" color="brand.500" />
        </Flex>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="ダッシュボード" subtitle="Factrailの概要を確認">
      {/* Stats Grid */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mb={8}>
        <StatCard
          label="総Facts数"
          value={stats.totalFacts.toString()}
          helpText={`過去30日間で+${stats.factsLast30Days}`}
          icon={FiDatabase}
          color="brand"
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
        <StatCard
          label="今日のアクティビティ"
          value={stats.todayActivity.toString()}
          helpText="直近24時間"
          icon={FiActivity}
          color="accent"
        />
      </SimpleGrid>

      {/* Recent Activity */}
      <Card bg="gray.800" borderColor="gray.700" borderWidth="1px">
        <CardBody>
          <Text fontSize="lg" fontWeight="semibold" mb={4}>
            最近のアクティビティ
          </Text>
          {recentFacts.length === 0 ? (
            <Flex justify="center" align="center" py={10}>
              <Text color="gray.500">アクティビティがありません</Text>
            </Flex>
          ) : (
            <VStack spacing={4} align="stretch">
              {recentFacts.map((fact) => (
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
